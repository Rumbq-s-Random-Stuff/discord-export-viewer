import * as channels from "./channels.js";
import { displayMessage } from './messages.js';

const searchInput = document.getElementById('searchInput');
/*const searchDropdown = document.getElementById('searchDropdown');

// Show dropdown when input is focused
searchInput.addEventListener('focus', () => {
    searchDropdown.style.display = 'block';
});

// Hide dropdown when input is blurred
searchInput.addEventListener('blur', () => {
    setTimeout(() => {
        //searchDropdown.style.display = 'none';
    }, 100); // Delay to allow click on dropdown
});

// Handle selection of a search option
searchDropdown.querySelectorAll('li').forEach(option => {
    option.addEventListener('click', () => {
        const optionText = option.getAttribute('data-option');
        searchInput.value += `${optionText}: `; // Add selected option to input
        searchInput.focus(); // Keep focus on input
    });
});*/

function searchMessages(query) {
    let reverse = false;
    let contentSearch = ''; // For any trailing content search
    let keyValuePairs = [];

    const lowerQuery = query.toLowerCase().trim();

    // Step 1: Use regex to split query into key-value pairs and content search
    // The regex captures both normal key: value pairs and values inside quotes
    const regex = /(\w+:\s*"(.*?)"|\w+:\s*(\S+))/g; // Matches key: "quoted value" or key: value
    const matches = lowerQuery.match(regex); // Extract all key-value pairs
    keyValuePairs = matches || []; // If no matches, fallback to empty array

    // Step 2: Handle the content search (anything not part of key-value pairs)
    contentSearch = lowerQuery.replace(regex, '').trim(); // Remove key-value pairs, leaving content

    // Step 3: Filter messages based on key-value pairs and content search
    let results = channels.currentChannelData.messages.filter(message => {
        const author = message.author.name.toLowerCase(); // Get message author name
        const content = message.content.toLowerCase(); // Get message content

        // Step 4: Match key-value pairs
        const matchesKeyValuePairs = keyValuePairs.every(pair => {
            const [key, ...rest] = pair.split(':').map(s => s.trim()); // Split by colon, get key and rest
            let value = rest.join(':').trim(); // Join back to a single value string
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            
            // Remove surrounding quotes from the value if they exist
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1); // Remove the surrounding quotes
            }

            // Normalize the value for comparison
            value = value.trim().toLowerCase(); // Ensure no extra spaces and case-insensitive

            switch (key) {
                case 'from':
                    return author === value || author.includes(value);
                case 'mentions':
                    return message.mentions.some(mention => mention.name.toLowerCase() === value.toLowerCase()); // Exact match for mentions
                case 'has':
                    return message.attachments.some(att => att.url.toLowerCase().includes(value)) || 
                           content.includes(value);
                case 'before':
                    const beforeDate = new Date(value);
                    return new Date(message.timestamp) < beforeDate;
                case 'during':
                    const duringDate = new Date(value);
                    return new Date(message.timestamp).toDateString() === duringDate.toDateString();
                case 'after':
                    const afterDate = new Date(value);
                    return new Date(message.timestamp) > afterDate;
                case 'pinned':
                    return message.isPinned === (value === 'true');
                case 'reverse':
                    reverse = value === 'true';
                    return true;
                default:
                    return content.includes(value); // Search content for the value
            }
        });

        // Step 5: Match content search
        return matchesKeyValuePairs && (!contentSearch || content.includes(contentSearch));
    });

    if (reverse) results = results.reverse();

    displaySearchResults(results);
    channels.toggleSection('search');
}


// Function to display search results
function displaySearchResults(results) {
    const resultsContainer = document.getElementById('searchResults'); // Ensure there's a container for search results
    resultsContainer.innerHTML = ''; // Clear previous results

    if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="title">No results found.</div>';
        return;
    } 

    // Create a container for the title and close button
    const titleDiv = document.getElementById("searchTitle");
    titleDiv.innerHTML = '';

    // Create the title text
    const titleText = document.createTextNode(`Found ${results.length} matches`);
    
    // Create the close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close'; // You can customize this to an icon or text as needed
    closeButton.className = 'close-button'; // Add a class for styling
    closeButton.onclick = () => {
        channels.toggleSection(null);
    };
    
    // Append the title text and close button to the title div
    titleDiv.appendChild(titleText);
    titleDiv.appendChild(closeButton);

    results.forEach(message => {
        const messageElement = displayMessage(message, "search"); // Assuming displayMessage is defined to create a message element
        messageElement.addEventListener('click', () => {
            channels.loadMessagesAround(message.id);
        });
        resultsContainer.appendChild(messageElement);
    });
}


searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent form submission if inside a form
        const query = searchInput.value;
        searchMessages(query);
    }
});