import { displayMessage, displayMessages } from './messages.js';
import * as aes from './aes.js'

let members = [];
export let messages = {};
let loadedMessages = []; // Now holds only message IDs
export let currentChannelData = null;
let loadedMessageOffset = 0;
let toLoadBottomMessages = 0;
const messagesPerPage = 100;
export let membersToggled = true;
export let pinnedToggled = false;
const membersList = document.getElementById('membersList');
const pinnedList = document.getElementById('pinnedList');
let keys = null;

export function setKeys(keysArr) {
    keys = keysArr;
}

function updateChannelDisplay(channelName, channelTopic, pre='') {
    const channelDiv = document.querySelector('.channel-display');
    channelDiv.querySelector('.selected-channel').textContent = `${pre}# ${channelName}`;
    
    const topicDiv = channelDiv.querySelector('.channel-topic');
    topicDiv.textContent = channelTopic ? channelTopic : ''; // Update or clear topic
}

export async function loadCategories(categories) {
    const categorySection = document.getElementById('categorySection');
    categorySection.innerHTML = ''; // Clear previous data

    let validChannels = {}

    for (const categoryId of Object.keys(categories)) {
        const categoryName = categories[categoryId].name; // Get the category name
        const categoryDiv = await createCategoryElement(categoryId, categoryName ? categoryName : '');
        const categoryChannels = await loadChannels(categoryId, categories, categoryDiv);
        Object.keys(categoryChannels).forEach(channelId => validChannels[channelId] = categoryChannels[channelId]);
    }

    return validChannels
}

function createCategoryElement(categoryId, categoryName) {
    let categoryDiv = document.createElement('div');
    categoryDiv.classList.add('category');
    categoryDiv.setAttribute('data-category', categoryId);
    categoryDiv.innerHTML = `
        <h4 class="category-title">${categoryName}</h4>
        <div class="channel-list" style="display: block;"></div>
    `;

    // Append category to the category section
    const categorySection = document.getElementById('categorySection');
    categorySection.appendChild(categoryDiv);

    // Toggle category visibility on title click
    const categoryTitle = categoryDiv.querySelector('.category-title');
    categoryTitle.onclick = () => {
        const channelListDiv = categoryDiv.querySelector('.channel-list');
        const isVisible = channelListDiv.style.display === 'block';
        channelListDiv.style.display = isVisible ? 'none' : 'block';
    };

    return categoryDiv
}

async function loadChannels(categoryId, categories, categoryDiv) {
    const channels = categories[categoryId].channels ? categories[categoryId].channels : categories[categoryId]; // Get channels from the category
    //console.log(channels)
    let validChannels = {};
    for (const [channelId, channelData] of Object.entries(channels)) {
        const validKey = keys.find(key => aes.keyHash(key) === channelData.key);
        //console.log(validKey)
        if (validKey) {
            validChannels[channelId] = validKey;
            await createChannelElement(validKey, channelId, channelData.name, channelData.topic, channelData.chunks, categoryDiv);
        } else {
            console.warn(`Invalid key for channel ${channelId}. Skipping channel creation.`);
        }
    }
    return validChannels
}

async function createChannelElement(key, channelId, channelName, topic, chunks, categoryDiv) {
    const channelDiv = document.createElement('div');
    channelDiv.classList.add('channel');
    channelDiv.textContent = `# ${channelName}`; // Use the passed channelName
    if (topic) channelDiv.title = topic;

    // Click event to load messages and highlight the selected channel
    channelDiv.onclick = () => {
        createChunkButtons(channelId, chunks);
        loadChannelMessages(channelId, channelDiv, key);
    };

    // Append the channel to the category's channel list
    const channelListDiv = categoryDiv.querySelector('.channel-list');
    channelListDiv.appendChild(channelDiv);
}

export function createChunkButtons(channelId, chunks) {
    channelId = channelId ? channelId : currentChannelData.channel.id;
    chunks = chunks ? chunks : currentChannelData.map.chunks;
    const chunkButtonsDiv = document.getElementById('chunkButtons');
    chunkButtonsDiv.innerHTML = ''; // Clear existing buttons

    for (let i = 0; i < chunks; i++) {
        const button = document.createElement('button');
        button.innerText = `${i + 1}`;
        button.onclick = () => loadChannelMessages(channelId, null, null, i); // Load messages for this chunk
        chunkButtonsDiv.appendChild(button);
    }
}

function processBatch(rawMessages, index, firstBatch) {
    // Process a batch of messages
    const startIndex = Math.max(index - messagesPerPage + 1, 0); // Determine the start index for the batch

    for (; index >= startIndex; index--) { // Process messages in reverse order
        const message = rawMessages[index];
        messages[message.id] = message; // Store each message with its ID as the key
        loadedMessages.push(message.id);

        const memberExists = members.some(member => member.name === message.author.name && member.discriminator === message.author.discriminator);

        // If the member doesn't exist, add them to the array
        if (!memberExists) {
            members.push(message.author); // Add author to the array if not already present
            addMember(message.author);
        }

        if (message.isPinned) {
            addPinned(message);
        }
    }

    if (firstBatch) {
        firstBatch()
    }

    // Check if there are more messages to process
    if (index >= 0) {
        // Schedule the next batch
        setTimeout(() => processBatch(rawMessages, index, false), 0); // Process the next batch in the next event loop
    }
}

// Load and display channel messages with pagination
export function loadChannelMessages(channelId, channelDiv, key='', chunk=0) {
    const channelPath = `servers/${channelId}/${chunk}.json`;
    updateChannelDisplay("Loading...", "Decrypting and drawing content...");
    const messageDiv = document.getElementById('messages'); // Get the message display area
    messageDiv.innerHTML = ''
    //console.log(key)
    return new Promise((resolve, reject) => { // Wrap the logic in a Promise
        fetch(channelPath)
            .then(response => response.text())
            .then(async (encryptedData) => await aes.decrypt(encryptedData, key))
            .then(response => JSON.parse(response))
            .then(channelData => {
                updateChannelDisplay(channelData.channel.name, channelData.channel.topic, chunk+1);

                loadedMessageOffset = 0;
                currentChannelData = channelData;
                messages = {};
                loadedMessages = [];
                members = [];
                let totalMessages = channelData.messages.length;
                let index = totalMessages - 1; // Start from the last message

                membersList.innerHTML = ''; // Clear any previous content  
                pinnedList.innerHTML = '';      

                // Start processing the first batch of messages
                processBatch(channelData.messages, index, () => {
                    // Load the initial batch of messages and scroll to the bottom
                    messageDiv.innerHTML = ""; // Clear the loading message
                    displayMessages(loadedMessages.slice(loadedMessageOffset, loadedMessageOffset + messagesPerPage).toReversed().map(id => messages[id])); // Reverse the batch for correct display order
                    scrollToBottom();
                    setupInfiniteScroll();
                    if (channelDiv) highlightSelectedChannel(channelDiv);
                    loadedMessageOffset += messagesPerPage;
                }, true);
                resolve()
            })
            .catch(error => {
                console.error('Error loading messages:', error);
                messageDiv.innerHTML = '<p>Error loading messages. Please try again.</p>'; // Show error message
                reject(error); // Reject the promise on error
            });
    });
}

let activeSection = 'members'; // Track the currently active section ('members' or 'pinned')

const additionalSection = document.getElementById('additionalSection');
export function toggleSection(section) {
    // If the same section is clicked, just close it
    if (activeSection === null) {
        additionalSection.style.display = 'block';
    }
    if (activeSection === section || section === null) {
        if(section === 'search') return;
        activeSection = null;
        additionalSection.style.display = additionalSection.style.display = 'none';
        hideAllSections();
    } else {
        activeSection = section;
        showSection(section); // Show the relevant section
    }
}

function hideAllSections() {
    // Hide all sections by setting their display to 'none'
    document.getElementById('membersSection').style.display = 'none';
    document.getElementById('pinnedSection').style.display = 'none';
    document.getElementById('searchSection').style.display = 'none';
}

function showSection(section) {
    hideAllSections(); // Hide all sections before showing the active one

    const sectionDiv = document.getElementById(`${section}Section`);
    if (sectionDiv) {
        sectionDiv.style.display = 'block'; // Show the chosen section
    }
}

function addMember(member) {
    const listItem = document.createElement('li');
    listItem.classList.add('member-item');

    // Create a span for the username with color
    const usernameSpan = document.createElement('span');
    usernameSpan.textContent = member.name;
    usernameSpan.style.color = member.color || '#FFFFFF'; // Default to white if no color
    usernameSpan.classList.add('username');

    listItem.appendChild(usernameSpan);

    // Add a bot label if necessary
    if (member.isBot) {
        const botLabel = document.createElement('span');
        botLabel.textContent = 'BOT';
        botLabel.classList.add('bot-label');
        listItem.appendChild(botLabel);
    }

    membersList.appendChild(listItem);
}

function addPinned(message) {
    const listItem = document.createElement('li');
    listItem.classList.add('pinned-message-item');
    listItem.appendChild(displayMessage(message, 'Pinned'))
    listItem.addEventListener('click', () => {
        loadMessagesAround(message.id);
    });
    pinnedList.appendChild(listItem);
}

// Function to highlight the selected channel
function highlightSelectedChannel(selectedChannelDiv) {
    // Remove 'selected' class from all channels
    const allChannels = document.querySelectorAll('.channel');
    allChannels.forEach(channel => {
        channel.classList.remove('selected'); // Remove selected class from all channels
    });

    // Add 'selected' class to the currently selected channel
    selectedChannelDiv.classList.add('selected');
}

// Scroll to the bottom of the message list
function scrollToBottom() {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function scrollToMessage(messageDiv) {
    // Block further scrolling during the centering of the message
    const messagesDiv = document.getElementById('messages');
    messagesDiv.onscroll = null;

    // Scroll to the message and highlight it
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messageDiv.classList.add('highlight'); // Apply highlight

    // Remove the highlight after 1 second
    setTimeout(() => {
        messageDiv.classList.remove('highlight');
        // Re-enable scrolling after the message is centered
        setupInfiniteScroll();
    }, 1000); // 1 second delay
}

export function loadMessagesAround(messageId) {
    const messageDiv = document.getElementById(`message-${messageId}`);
    
    if (!messageDiv) {
        // The message is not loaded, fetch the batch of messages around it
        document.getElementById('messages').innerHTML = '';
        const messageDiv = loadBatchOfMessagesAround(messageId);  // Load 100 messages around it
        if (messageDiv) {
            scrollToMessage(messageDiv);
        }
    } else {
        // Scroll to the message if it's already loaded and highlight it
        scrollToMessage(messageDiv);
    }
}

function loadBatchOfMessagesAround(messageId) {
    const index = loadedMessages.findIndex(id => id === messageId);
    if (index === -1) return;
    const startIndex = index - messagesPerPage / 2;
    const endIndex = index + messagesPerPage / 2;

    loadedMessageOffset = endIndex;
    displayMessages(loadedMessages.slice(startIndex, endIndex).toReversed().map(id => messages[id]));

    toLoadBottomMessages = startIndex;

    return document.getElementById(`message-${messageId}`);
}

function loadBatchOfMessagesAfter(messageId) {
    const index = loadedMessages.findIndex(id => id === messageId);
    if (index === -1) return;
    const startIndex = index - messagesPerPage;
    const endIndex = index;

    loadedMessageOffset = endIndex;
    displayMessages(loadedMessages.slice(startIndex, endIndex).toReversed().map(id => messages[id]));

    toLoadBottomMessages = startIndex;

    return document.getElementById(`message-${messageId}`);
}

// Fix for loading more messages when scrolling down
function setupInfiniteScroll() {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.onscroll = () => {
        // Load more when scrolled to the top
        if (messagesDiv.scrollTop / messagesDiv.scrollHeight <= 0.15 && loadedMessageOffset < loadedMessages.length) {
            const startIndex = Math.max(0, loadedMessageOffset);
            const endIndex = Math.min(loadedMessages.length, loadedMessageOffset + messagesPerPage);
            displayMessages(loadedMessages.slice(startIndex, endIndex).toReversed().map(id => messages[id]));
            loadedMessageOffset += messagesPerPage;
        }

        if (messagesDiv.scrollTop / messagesDiv.scrollHeight >= 0.85 && toLoadBottomMessages > 0) {
            const startIndex = Math.max(0, toLoadBottomMessages - messagesPerPage);
            const endIndex = Math.min(loadedMessages.length, toLoadBottomMessages);
            displayMessages(loadedMessages.slice(startIndex, endIndex).toReversed().map(id => messages[id]), true);
            toLoadBottomMessages -= messagesPerPage;
        }
    };
}