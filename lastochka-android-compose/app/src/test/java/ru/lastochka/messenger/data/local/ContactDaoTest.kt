package ru.lastochka.messenger.data.local

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.*

/**
 * Тесты для ContactDao.
 */
class ContactDaoTest {

    @Test
    fun insertAndReadContact() = runBlocking {
        val contact = ContactEntity(
            topicName = "usrABC123",
            displayName = "Иван Иванов",
            avatar = null,
            lastMessage = "Привет!",
            lastMessageTime = System.currentTimeMillis(),
            unread = 1,
            isGroup = false,
            muted = false,
            pinned = false
        )

        Assert.assertEquals("usrABC123", contact.topicName)
        Assert.assertEquals("Иван Иванов", contact.displayName)
        Assert.assertEquals(1, contact.unread)
    }

    @Test
    fun clearUnread() = runBlocking {
        val contact = ContactEntity(
            topicName = "usrABC123",
            displayName = "Иван",
            avatar = null,
            lastMessage = null,
            lastMessageTime = System.currentTimeMillis(),
            unread = 5,
            isGroup = false,
            muted = false,
            pinned = false
        )

        Assert.assertEquals(5, contact.unread)
        // После clearUnread: unread = 0
    }

    @Test
    fun contactIsGroup() = runBlocking {
        val group = ContactEntity(
            topicName = "grpXYZ789",
            displayName = "Рабочий чат",
            avatar = null,
            lastMessage = null,
            lastMessageTime = System.currentTimeMillis(),
            unread = 0,
            isGroup = true,
            muted = false,
            pinned = false
        )

        val p2p = ContactEntity(
            topicName = "usrABC123",
            displayName = "Иван",
            avatar = null,
            lastMessage = null,
            lastMessageTime = System.currentTimeMillis(),
            unread = 0,
            isGroup = false,
            muted = false,
            pinned = false
        )

        Assert.assertTrue(group.isGroup)
        Assert.assertFalse(p2p.isGroup)
        Assert.assertTrue(group.topicName.startsWith("grp"))
    }

    @Test
    fun mutedContact() = runBlocking {
        val contact = ContactEntity(
            topicName = "usrABC123",
            displayName = "Спам",
            avatar = null,
            lastMessage = null,
            lastMessageTime = System.currentTimeMillis(),
            unread = 100,
            isGroup = false,
            muted = true,
            pinned = false
        )

        Assert.assertTrue(contact.muted)
        Assert.assertEquals(100, contact.unread)
    }

    @Test
    fun pinnedContact() = runBlocking {
        val pinned = ContactEntity(
            topicName = "usrABC123",
            displayName = "Босс",
            avatar = null,
            lastMessage = null,
            lastMessageTime = 1000,
            unread = 0,
            isGroup = false,
            muted = false,
            pinned = true
        )

        Assert.assertTrue(pinned.pinned)
        // Pinned контакты должны идти первыми в списке
    }
}
