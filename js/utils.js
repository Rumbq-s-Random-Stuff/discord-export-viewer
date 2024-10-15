// utils.js

// Toggle pinned messages slide panel
document.getElementById('togglePinned').onclick = () => {
    const pinnedMessagesPanel = document.getElementById('pinnedMessages');
    pinnedMessagesPanel.classList.toggle('active');
    
    if (pinnedMessagesPanel.classList.contains('active')) {
        loadPinnedMessages();
    }
};

// Load pinned messages
function loadPinnedMessages() {
    const pinnedMessagesDiv = document.getElementById('pinnedMessageList');
    pinnedMessagesDiv.innerHTML = ''; // Clear previous data
    
    const pinnedMessages = currentMessages.filter(message => message.isPinned);
    pinnedMessages.forEach(message => {
        const pinnedMessageDiv = document.createElement('div');
        pinnedMessageDiv.classList.add('message');
        pinnedMessageDiv.innerHTML = `
            <div class="author">${message.author.name}#${message.author.discriminator}</div>
            <div class="content">${message.content}</div>
        `;
        pinnedMessagesDiv.appendChild(pinnedMessageDiv);
    });
}

// Toggle members list slide panel
document.getElementById('toggleMembers').onclick = () => {
    const membersListPanel = document.getElementById('membersList');
    membersListPanel.classList.toggle('active');
    
    if (membersListPanel.classList.contains('active')) {
        loadMembers();
    }
};

// Load members list
function loadMembers() {
    const membersDiv = document.getElementById('members');
    membersDiv.innerHTML = ''; // Clear previous data

    const members = {};
    
    currentMessages.forEach(message => {
        const author = message.author;
        if (!members[author.id]) {
            members[author.id] = author;
        }
    });

    Object.values(members).forEach(member => {
        const memberDiv = document.createElement('div');
        memberDiv.classList.add('member');
        memberDiv.innerHTML = `
            <div class="name">${member.name}#${member.discriminator}</div>
            <div class="nickname">${member.nickname || ''}</div>
        `;
        membersDiv.appendChild(memberDiv);
    });
}
