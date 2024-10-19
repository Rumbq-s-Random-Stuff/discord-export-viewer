// messages.js
import * as channels from "./channels.js"
import * as servers from './servers.js'

let emojis = {};
const dateFormatSelector = document.getElementById('dateFormatSelector');

export function setEmojis(emojisDict) {
    emojis = emojisDict;
}

// Function to format the date based on the selected format
function formatDate(timestamp, includeFullDate = true) {
    const date = new Date(timestamp);
    const selectedFormat = dateFormatSelector.value;

    if (includeFullDate) {
        switch (selectedFormat) {
            case 'us':
                return date.toLocaleString('en-US'); // MM/DD/YYYY HH:mm
            case 'iso':
                return date.toISOString().replace('T', ' ').split('.').slice(0, -1).join('.'); // YYYY-MM-DD HH:mm:ss
            case 'default':
            default:
                return date.toLocaleString('en-GB'); // DD.MM.YYYY HH:mm
        }
    } else {
        // Return only HH:mm formatted based on user selection
        switch (selectedFormat) {
            case 'us':
                return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            case 'iso':
                return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
            case 'default':
            default:
                return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
        }
    }
}

export function displayMessage(message, type = '') {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.id = `message${type}-${message.id}`;

    const timestamp = new Date(message.timestamp);
    const formattedTimestamp = formatDate(message.timestamp);
    const hoursMinutes = formatDate(message.timestamp, false);

    let editedTimestamp = '';
    let editedHoursMinutes = '';

    if (message.timestampEdited) {
        editedTimestamp = ` (Edited at: ${formatDate(message.timestampEdited)})`;
        editedHoursMinutes = ` (Edited at: ${formatDate(message.timestampEdited, false)})`;
    }

    const shouldShowUsernameWithTimestamp = message.author.name || (timestamp - previousTimestamp) >= 420000;

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('content-wrapper');
    
    const authorColor = message.author.color || '#FFFFFF';

    if (message.reference) {
        let refId = message.reference.messageId;
        const referenceDiv = document.createElement('div');
        referenceDiv.classList.add('reference');

        const refContent = channels.messages[refId]
            ? `<strong>${channels.messages[refId]?.author.name}</strong>: ${getReferencedMessageContent(channels.messages[refId])}`
            : "Couldn't load the message";

        referenceDiv.innerHTML = `
            <div class="reference-wrapper">
                <div class="reference-content">
                    ${refContent}
                </div>
            </div>
        `;

        referenceDiv.addEventListener("click", () => {
            const referencedMessage = document.getElementById(`message-${refId}`);
            if (referencedMessage) {
                referencedMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                channels.loadMessagesAround(refId);
            }
        });

        messageDiv.appendChild(referenceDiv);
    }

    // Check for "GuildMemberJoin" type and apply specific styling
    if (message.type === 'GuildMemberJoin') {
        messageDiv.classList.add('guild-member-join'); // Add a specific class for styling
        contentWrapper.innerHTML = `
            <div class="join-message">
                <strong><span class="mentions">@${message.author.name}</span> joined the server.</strong>
                <span class="timestamp">${formattedTimestamp}</span>
            </div>
        `;
    } else if (message.type === '8') {
        messageDiv.classList.add('server-boost'); // Add a specific class for server boost styling
        contentWrapper.innerHTML = `
            <div class="boost-message">
                <strong><span class="mentions">@${message.author.name}</span> just Boosted the server!</strong>
                <span class="timestamp">${formattedTimestamp}</span>
            </div>
        `;
    } else {
        // Default message display
        contentWrapper.innerHTML = `
            <div class="message-header">
                <div class="author" style="color: ${authorColor};">
                    ${shouldShowUsernameWithTimestamp ? message.author.name : ""}
                </div>
                <div class="timestamp">
                    ${shouldShowUsernameWithTimestamp ? formattedTimestamp + editedTimestamp : ""}
                </div>
            </div>
            <div class="content">
                <div>${parseMentions(parseMarkdown(message.content), message.mentions)}</div>
                ${attachmentsContent(message.attachments)}
                ${embedContent(message.embeds)}
            </div>
        `;

        if (!shouldShowUsernameWithTimestamp) {
            contentWrapper.innerHTML += `<span class="timestamp-hhmm">${hoursMinutes + editedHoursMinutes}</span>`;
        }
    }

    messageDiv.appendChild(contentWrapper);

    // Add reactions, if present
    if (message.reactions && message.reactions.length > 0) {
        const reactionsDiv = document.createElement('div');
        reactionsDiv.classList.add('reactions');
        message.reactions.forEach(reaction => {
            const reactionDiv = document.createElement('div');
            reactionDiv.classList.add('reaction');
            reactionDiv.innerHTML = `
                <img src="${reaction.emoji.imageUrl}" alt="${reaction.emoji.name}" />
                <span>${reaction.count}</span>
            `;
            reactionsDiv.appendChild(reactionDiv);
        });
        messageDiv.appendChild(reactionsDiv);
    }

    // Create the button for copying the link
    const copyLinkButton = document.createElement('button');
    copyLinkButton.classList.add('copy-link-button');
    copyLinkButton.innerText = '🔗';
    
    // Append the button to the messageDiv
    messageDiv.appendChild(copyLinkButton);
    
    // Add event listener to copy the link to clipboard
    copyLinkButton.addEventListener('click', () => {
        const url = `https://rumbq-s-random-stuff.github.io/discord-export-viewer/?server=${channels.currentChannelData.guild.id}&channel=${channels.currentChannelData.channel.id}&chunk=${channels.currentChannelData.map.current}&message=${message.id}`;
        navigator.clipboard.writeText(url).then(() => {
            alert("Link copied to clipboard!");
        }).catch(() => {
            alert("Failed to copy the link.");
        });
    });

    return messageDiv;
}



export function displayMessages(messages, append=false) {
    const messagesDiv = document.getElementById('messages');
    const fragment = document.createDocumentFragment();

    let previousAuthor = null;
    let previousTimestamp = null;

    messages.forEach(message => {
        const messageDiv = displayMessage(message);
        fragment.appendChild(messageDiv);

        previousAuthor = message.author.name;
        previousTimestamp = new Date(message.timestamp);
    });

    if (!append) messagesDiv.prepend(fragment); else messagesDiv.append(fragment);
}

// Function to display attachments
function attachmentsContent(attachments) {
    if (!attachments || attachments.length === 0) return '';

    return attachments.map(attachment => {
        const { url, fileName } = attachment;
        const extension = fileName.split('.').pop().toLowerCase();

        // Wrap each attachment in a <div> to ensure it starts on a new line
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
            // Image handling
            return `
                <div class="attachment image-attachment">
                    <img src="${url}" 
                         onerror="this.onerror=null; this.src='img/404.svg';" 
                         alt="${fileName}" />
                </div>
            `;
        } else if (['mp3', 'wav', 'ogg'].includes(extension)) {
            // Audio handling
            return `
                <div class="attachment audio-attachment">
                    <audio controls>
                        <source src="${url}" type="audio/${extension}">
                        Your browser does not support the audio tag.
                    </audio>
                    <span>${fileName}</span>
                </div>
            `;
        } else if (['mp4', 'webm', 'ogg'].includes(extension)) {
            // Video handling
            return `
                <div class="attachment video-attachment">
                    <video controls>
                        <source src="${url}" type="video/${extension}">
                        Your browser does not support the video tag.
                    </video>
                    <span>${fileName}</span>
                </div>
            `;
        } else {
            // Other file types
            return `
                <div class="attachment file-attachment">
                    <div class="file-info">
                        <span>${fileName}</span>
                        <span>(File type: ${extension})</span>
                    </div>
                </div>
            `;
        }
    }).join('');
}


// Function to embed content (images, videos, and other media)
function embedContent(embeds) {
    if (!embeds || embeds.length === 0) return '';

    return embeds.map(embed => `
        <div class="embed">
            ${embed.author && embed.author.iconUrl ? `
                <div class="embed-header">
                    <img src="${embed.author.iconUrl}" onerror="this.onerror=null; this.src='img/404.svg';" class="embed-author-icon" />
                    <span class="embed-author">${embed.author.name}</span>
                </div>
            ` : ''}
            ${embed.title ? `<h4>${parseMarkdown(embed.title)}</h4>` : ''}
            ${embed.description ? `<p>${parseMarkdown(embed.description)}</p>` : ''}
            ${embed.url ? `
                ${embed.thumbnail ? `
                    <img src="${embed.thumbnail.url}" 
                            onerror="this.onerror=null; this.src='img/404.svg';"/>` : ''}
            ` : ''}
            ${embed.image ? `
                <img src="${embed.image.url}" 
                     onerror="this.onerror=null; this.src='img/404.svg';"/>` : ''}
            ${embed.fields && embed.fields.length > 0 ? embed.fields.map(field => `
                <div class="embed-field">
                    ${field.name ? `<strong>${parseMarkdown(field.name)}</strong>` : ''}
                    ${field.value ? `<span>${parseMarkdown(field.value)}</span>` : ''}
                </div>
            `).join('') : ''}
            ${embed.footer ? `<div class="embed-footer">${parseMarkdown(embed.footer.text)}</div>` : ''}
        </div>
    `).join('');
}




// Parse mentions in the message content
function parseMentions(content, mentions) {
    if (mentions && mentions.length > 0) {
        mentions.forEach(mention => {
            const mentionTag = `<span class="mentions">@${mention.name}</span>`;
            content = content.replace(new RegExp(`@${mention.name}`, 'g'), mentionTag);
        });
    }
    return content;
}

// Function to parse Discord-like markup (bold, italic, links, code blocks, and newlines)
function parseMarkdown(content) {
    // Convert <link> format to clickable links
    content = content.replace(/<([^>]+)>/g, '<a href="$1" target="_blank">$1</a>');

    // Convert URLs to clickable links but ignore those already formatted
    content = content.replace(/(?<!<)(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');

    // Convert newlines to <br>
    content = content.replace(/\n/g, '<br>');

    // Handle code blocks (```code```)
    content = content.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');

    // Bold (**text**)
    content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Italic (*text* or _text_)
    content = content.replace(/\*(.*?)\*/g, '<em>$1</em>');
    content = content.replace(/_(.*?)_/g, '<em>$1</em>');

    // Underline (__text__)
    content = content.replace(/__(.*?)__/g, '<u>$1</u>');

    // Strikethrough (~~text~~)
    content = content.replace(/~~(.*?)~~/g, '<s>$1</s>');

    // Inline code (`code`)
    content = content.replace(/`(.*?)`/g, '<code>$1</code>');

    content = content.replace(/:(.*?):/g, (match, p1) => {
        const emojiKey = p1.trim();
        if (emojis[emojiKey]) {
            return `<img src="${emojis[emojiKey]}" alt="${emojiKey}" class="custom-emoji" />`;
        }
        return match; // If no match, keep the original text
    });

    return content;
}

// Function to get referenced message content or type
function getReferencedMessageContent(referencedMessage) {
    if (referencedMessage.content) {
        // If the message has content, return a snippet of the content
        return referencedMessage.content.length > 50
            ? referencedMessage.content.slice(0, 50) + '...'
            : referencedMessage.content;
    } else if (referencedMessage.attachments && referencedMessage.attachments.length > 0) {
        // If the message has attachments, return a description of the attachment type
        const attachment = referencedMessage.attachments[0];
        const extension = attachment.fileName.split('.').pop().toLowerCase();
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) {
            return "Image";
        } else if (['mp4', 'webm', 'ogg'].includes(extension)) {
            return "Video";
        } else if (['mp3', 'wav', 'ogg'].includes(extension)) {
            return "Audio";
        } else {
            return "File";
        }
    } else if (referencedMessage.embeds && referencedMessage.embeds.length > 0) {
        return "Embed";
    } else {
        return "Unknown content";
    }
}