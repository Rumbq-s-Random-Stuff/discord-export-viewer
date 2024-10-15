// servers.js

import { createChunkButtons, loadCategories, loadChannelMessages, loadMessagesAround, setKeys } from './channels.js';
import * as aes from './aes.js';
import * as messages from './messages.js'

const serverIndexPath = `servers/index.json`;

// Fetch the server list from index.json
export function loadServers() {
    const params = new URLSearchParams(window.location.search);
    let keys = params.getAll('key'); // Fetch all keys from the URL
    const serverIdValue = params.get('server');
    const force = params.get('force');

    const test = params.get('test');

    if (keys.length === 0) {
        const keyInput = prompt("You need a key to decrypt the data, you can provide many of them by forming url query(example.com?key=a&key=b) or by inputing one here:"); // Prompt the user for a key
        if (keyInput) {
            keys = [keyInput]; // Set the keys to the entered key
            // You may want to add the key to the URL for future reference:
            history.replaceState(null, '', `?key=${encodeURIComponent(keyInput)}`);
        } else {
            alert("No key entered. Unable to decrypt data."); // Alert if no key is entered
            return; // Exit the function early
        }
    }

    const serverListDiv = document.getElementById('serverList');
    serverListDiv.innerHTML = ''; // Clear previous data

    fetch(serverIndexPath)
        .then(response => response.json()) // Fetch as JSON directly
        .then(async (data) => {
            setKeys(keys)
            
            if (force) { forceLoadFromUrl(params, keys) }

            const validServers = Object.keys(data).filter(serverId => {
                const serverHash = data[serverId]; // Hash of the password
                return keys.some(key => aes.keyHash(key) === serverHash);
            });

            // Load each valid server and replace the hash with the actual password for decryption
            await Promise.all(validServers.map(async serverId => {
                const key = keys.find(k => CryptoJS.SHA256(CryptoJS.SHA256(k)).toString(CryptoJS.enc.Base64) === data[serverId]); // Get the matching key
                const index = `servers/${serverId}.json`;
                return fetch(index)
                    .then(response => response.text()) // Fetch as text first
                    .then(async (encryptedData) => {
                        const decryptedData = await aes.decrypt(encryptedData, key); // Decrypt with the valid key
                        //console.log(decryptedData);
                        const serverData = JSON.parse(decryptedData); // Parse the decrypted JSON
                        //console.log(encryptedData)
                        //console.log(serverData)
                        
                        const serverDiv = document.createElement('div');
                        serverDiv.classList.add('server-icon-wrapper');
                        
                        // Create an img element for the server icon
                        const serverIcon = document.createElement('img');
                        serverIcon.classList.add('server-icon');
                        serverIcon.src = serverData.icon; // Use the icon from the JSON
                        serverIcon.alt = serverData.name;
                        
                        // Fallback in case the image fails to load
                        serverIcon.onerror = () => {
                            serverIcon.style.display = 'none'; // Hide the image if it fails to load
                            serverDiv.innerHTML = `<span class="server-fallback-text">${serverData.name.charAt(0)}</span>`;
                            serverDiv.classList.add('server-fallback'); // Add fallback styling
                        };
                        
                        // On click, update the server display
                        serverDiv.onclick = () => {
                            updateServerDisplay(serverData.name);
                            messages.setEmojis(serverData.emojis);
                            loadCategories(serverData["categories"]);
                        };
                        
                        // Append the image (or fallback) to the server list
                        serverDiv.appendChild(serverIcon);
                        serverListDiv.appendChild(serverDiv);

                        if(serverIdValue == serverId && !force) {
                            await loadFromUrl(params, serverData, key); // Check URL after loading servers
                        }
                    })
                    .catch(error => console.error(`Error loading server ${serverId}:`, error));
            }));
        })
        .catch(error => console.error('Error loading servers:', error));
}

// Load from URL parameters in the key=value format
async function loadFromUrl(params, data, key) {
    const channelIdValue = params.get('channel');
    const chunkIdValue = params.get('chunk');
    const messageIdValue = params.get('message');

    updateServerDisplay(data.name);
    messages.setEmojis(data.emojis)
    var validChannels = await loadCategories(data["categories"]);

    if (channelIdValue && validChannels[channelIdValue]) {
        await loadChannelMessages(channelIdValue, null, key, chunkIdValue ? chunkIdValue : 0);
        createChunkButtons()
        if (chunkIdValue && messageIdValue) {
            loadMessagesAround(messageIdValue);
        }
    }
}

async function forceLoadFromUrl(params, keys) {
    const channelIdValue = params.get('channel');
    const chunkIdValue = params.get('chunk');
    const messageIdValue = params.get('message');

    await loadChannelMessages(channelIdValue, null, params.get('key'), chunkIdValue ? parseInt(chunkIdValue) : 0);
    createChunkButtons()
    if (chunkIdValue && messageIdValue) {
        loadMessagesAround(messageIdValue);
    }
}

// Update server display
function updateServerDisplay(serverName) {
    document.getElementById("serverName").textContent = serverName;
}

// ... rest of the existing code
