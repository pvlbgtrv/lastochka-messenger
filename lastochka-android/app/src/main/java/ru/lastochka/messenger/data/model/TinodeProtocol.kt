package ru.lastochka.messenger.data.model

import com.google.gson.*
import com.google.gson.annotations.SerializedName
import java.lang.reflect.Type
import java.util.*

// Кастомный десериализатор для PubContent
// Сервер может слать content как строку ("привет") или объект ({"txt":"привет"} или Drafty {"txt":"","ent":[...]})
object PubContentDeserializer : JsonDeserializer<PubContent> {
    override fun deserialize(json: JsonElement, typeOfT: Type, context: JsonDeserializationContext): PubContent {
        return when {
            json.isJsonObject -> {
                val obj = json.asJsonObject
                val txt = obj.get("txt")?.asString ?: ""
                val ent = if (obj.has("ent")) {
                    context.deserialize<Array<DraftyEntity>>(obj.get("ent"), Array<DraftyEntity>::class.java).toList()
                } else null
                val fmt = if (obj.has("fmt")) {
                    context.deserialize<Array<DraftyFmt>>(obj.get("fmt"), Array<DraftyFmt>::class.java).toList()
                } else null
                PubContent(txt, ent, fmt)
            }
            json.isJsonPrimitive -> PubContent(json.asString)
            else -> PubContent("")
        }
    }
}

// Кастомный десериализатор для TheCard.
// Сервер может слать public.photo как строку или объект (например {ref: "..."}).
object TheCardDeserializer : JsonDeserializer<TheCard> {
    override fun deserialize(json: JsonElement, typeOfT: Type, context: JsonDeserializationContext): TheCard {
        if (!json.isJsonObject) return TheCard()

        val obj = json.asJsonObject
        val fn = obj.get("fn")?.takeIf { it.isJsonPrimitive }?.asString
        val photo = parsePhoto(obj.get("photo"))

        return TheCard(fn = fn, photo = photo)
    }

    private fun parsePhoto(photoEl: JsonElement?): String? {
        if (photoEl == null || photoEl.isJsonNull) return null

        if (photoEl.isJsonPrimitive) {
            return photoEl.asString
        }

        if (!photoEl.isJsonObject) return null
        val obj = photoEl.asJsonObject

        // Частые варианты в Tinode payload.
        obj.get("ref")?.takeIf { it.isJsonPrimitive }?.let { return it.asString }
        obj.get("val")?.takeIf { it.isJsonPrimitive }?.let { return it.asString }
        obj.get("data")?.takeIf { it.isJsonObject }?.asJsonObject?.let { data ->
            data.get("ref")?.takeIf { it.isJsonPrimitive }?.let { return it.asString }
            data.get("val")?.takeIf { it.isJsonPrimitive }?.let { return it.asString }
        }

        return null
    }
}

// ─── Client Messages ─────────────────────────────────────────────

data class ClientMsgHi(
    val hi: HiPacket
)

data class HiPacket(
    val id: String,
    @SerializedName("ver") val version: String = "0.25",
    @SerializedName("ua") val userAgent: String = "lastochka-android/1.0"
)

data class ClientMsgAcc(
    val acc: AccPacket
)

data class AccPacket(
    val id: String,
    val user: String? = null,
    val scheme: String = "basic",
    val secret: String,
    val login: Boolean = false,
    val desc: DescPacket? = null,
    val tags: List<String>? = null,
    val cred: List<Credential>? = null
)

data class Credential(
    val meth: String,  // "email", "tel"
    val val_str: String? = null,  // value - renamed to avoid Kotlin keyword
    val done: Boolean = false
)

data class DescPacket(
    val `public`: TheCard? = null,
    val private: Any? = null
)

data class TheCard(
    val fn: String? = null,
    val photo: String? = null
)

data class ClientMsgLogin(
    val login: LoginPacket
)

data class LoginPacket(
    val id: String,
    val scheme: String = "basic",
    val secret: String
)

data class ClientMsgSub(
    val sub: SubPacket
)

data class SubPacket(
    val id: String,
    val topic: String? = null,
    val get: MetaGetPacket? = null,
    val set: MetaSetPacket? = null
)

data class MetaGetPacket(
    val desc: MetaGetDesc? = null,
    val sub: MetaGetSub? = null,
    val data: MetaGetData? = null,
    val what: String? = null
)

data class MetaGetDesc(val ims: Long? = null)
data class MetaGetSub(val ims: Long? = null) {
    companion object {
        /** Запросить ВСЕ подписки (без ims ограничения) */
        val All = MetaGetSub()  // пустой объект {} при сериализации
    }
}
data class MetaGetData(
    val since: Int? = null,
    val limit: Int? = 100
)

data class MetaSetPacket(
    val desc: MetaSetDesc? = null,
    val sub: MetaSetSub? = null
)

data class MetaSetDesc(
    val tags: List<String>? = null,
    val `public`: Any? = null,
    val `private`: Any? = null
)

/**
 * Приватные данные пользователя в me-топике.
 */
data class PrivateData(
    val note: String? = null
)

data class MetaSetSub(val user: String? = null, val mode: String? = null)

data class ClientMsgPub(
    val pub: PubPacket
)

data class PubPacket(
    val id: String,
    val topic: String,
    val content: PubContent,
    val head: PubHead? = null,
    val extra: PubExtra? = null
)

data class PubContent(
    val txt: String = "",
    val ent: List<DraftyEntity>? = null,
    val fmt: List<DraftyFmt>? = null
)

/** Drafty-формат для сообщений с вложениями */
data class PubContentDrafty(
    val txt: String = "",
    val ent: List<DraftyEntity>? = null,
    val fmt: List<DraftyFmt>? = null
)

/** Вложение в Drafty */
data class DraftyEntity(
    val tp: String = "EX",          // Тип: EX = external
    val `data`: DraftyData? = null
)

/** Данные вложения */
data class DraftyData(
    val mime: String? = null,             // "image/jpeg", "image/png" и т.д.
    val name: String? = null,             // имя файла
    val ref: String? = null,              // URL: "/v0/file/s/abc123.jpg"
    @SerializedName("val") val val_str: String? = null,  // inline base64 data (от web клиента)
    val size: Long? = null,               // размер в байтах
    val width: Int? = null,               // ширина изображения
    val height: Int? = null               // высота изображения
)

/** Форматирование в Drafty (ссылка на entity) */
data class DraftyFmt(
    val at: Int,                    // позиция начала
    val len: Int,                   // длина
    val key: Int                    // индекс в ent
)

/** Extra с attachments (для garbage collection файлов) */
data class PubExtra(
    val attachments: List<String>   // ["/v0/file/s/abc123.jpg"]
)

data class PubHead(
    val replaces: String? = null
)

data class ClientMsgNote(
    val note: NotePacket
)

data class NotePacket(
    val id: String,
    val topic: String,
    val what: String,
    val seq: Int? = null
)

data class ClientMsgLeave(
    val leave: LeavePacket
)

data class LeavePacket(
    val id: String,
    val topic: String,
    val unsub: Boolean = false
)

data class ClientMsgGet(
    val get: GetPacket
)

data class GetPacket(
    val id: String,
    val topic: String,
    val desc: MetaGetDesc? = null,
    val sub: MetaGetSub? = null,
    val data: MetaGetData? = null,
    val what: String? = null
)

data class ClientMsgSet(
    val set: SetPacket
)

data class SetPacket(
    val id: String,
    val topic: String,
    val desc: MetaSetDesc? = null,
    val sub: MetaSetSub? = null
)

data class ClientMsgDel(
    val del: DelPacket
)

data class DelPacket(
    val id: String,
    val topic: String,
    val seq: DelSeq,
    val hard: Boolean = false
)

data class DelSeq(
    val first: Int,
    val last: Int
)

// ─── Server Messages ─────────────────────────────────────────────

data class ServerMessage(
    val ctrl: CtrlPacket? = null,
    val data: DataPacket? = null,
    val meta: MetaPacket? = null,
    val pres: PresPacket? = null,
    val info: InfoPacket? = null,
    val del: DelPacket? = null
) {
    val type: MsgType
        get() = when {
            ctrl != null -> MsgType.CTRL
            data != null -> MsgType.DATA
            meta != null -> MsgType.META
            pres != null -> MsgType.PRES
            info != null -> MsgType.INFO
            del != null -> MsgType.DEL
            else -> MsgType.UNKNOWN
        }
}

enum class MsgType { CTRL, DATA, META, PRES, INFO, DEL, UNKNOWN }

data class CtrlPacket(
    val id: String? = null,
    val code: Int,
    val text: String? = null,
    val topic: String? = null,
    val params: CtrlParams? = null
)

data class CtrlParams(
    val user: String? = null,
    val token: String? = null,
    val recv: Int? = null,
    val read: Int? = null,
    val url: String? = null       // URL загруженного файла
)

data class DataPacket(
    val topic: String,
    val from: String? = null,
    val seq: Int,
    val content: PubContent,
    val head: PubHead? = null,
    val extra: PubExtra? = null,
    val ts: String? = null
)

data class MetaPacket(
    val id: String? = null,
    val topic: String? = null,
    val desc: MetaDesc? = null,
    val data: List<MetaDataPacket>? = null,
    val sub: List<MetaSub>? = null,
    val tags: List<String>? = null,
    val cred: List<Any>? = null,
    val `public`: TheCard? = null
)

data class MetaDataPacket(
    val from: String? = null,
    val seq: Int = 0,
    val content: PubContent? = null,
    val head: PubHead? = null,
    val extra: PubExtra? = null,
    val ts: String? = null
)

data class MetaDesc(
    val created: String? = null,
    val updated: String? = null,
    val tags: List<String>? = null,
    val cred: List<Any>? = null,
    val acs: Acs? = null,
    val `public`: TheCard? = null,
    val `private`: Any? = null
)

data class MetaSub(
    val user: String? = null,
    val topic: String? = null,
    val updated: String? = null,
    val seq: Int = 0,
    val read: Int = 0,
    val recv: Int = 0,
    val unread: Int = 0,
    val acs: Acs? = null,
    val `public`: TheCard? = null,
    val private: Any? = null,
    val lastSeen: LastSeen? = null
)

data class LastSeen(
    val when_ts: String? = null,
    val ua: String? = null,
    val recv: Long? = null
)

data class Acs(
    val want: String? = null,
    val given: String? = null,
    val mode: String? = null
)

data class PresPacket(
    val topic: String,
    val what: String,
    val src: String? = null,
    val seq: Int? = null,
    val delp: DelMsg? = null
)

data class DelMsg(
    val delId: Int? = null,
    val first: Int? = null,
    val last: Int? = null,
    val all: Boolean = false
)

data class InfoPacket(
    val topic: String,
    val from: String,
    val what: String,
    val seq: Int? = null
)
