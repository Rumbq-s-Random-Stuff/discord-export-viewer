// main.js

// Importing other modules
import { loadServers } from './servers.js';
import { toggleSection } from './channels.js';
import './search.js'
//import { loadUtils } from './utils.js';

const serverIndexPath = `servers/index.json`;
let currentMessages = [];
let currentChannelData = null;

// Initialize everything
window.onload = () => {
    //console.log(CryptoJS.SHA256(CryptoJS.SHA256("treehouse")).toString(CryptoJS.enc.Base64));
    loadServers();
    //loadUtils();
};

// Add to your js/main.js

// Add to your js/main.js

const serverInfo = document.getElementById('serverInfo');

const toggleChannelsButton = document.getElementById('toggleChannels');
toggleChannelsButton.onclick = () => {
    serverInfo.classList.toggle('hide'); // Toggle visibility
    const isHidden = serverInfo.classList.contains('hide');
};

// Display the list of members in the additionalSection when toggle button is clicked
document.getElementById('toggleMembers').addEventListener('click', () => {
    toggleSection("members");
});

document.getElementById('togglePinned').addEventListener('click', () => {
    toggleSection("pinned");
});