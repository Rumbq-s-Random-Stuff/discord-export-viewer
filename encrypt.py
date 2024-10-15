import os
import json
import base64
import hashlib
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
import shutil

def generate_key(password):
    """Generate a key for encryption based on the provided password."""
    password_bytes = password.encode('utf-8')
    # Use SHA-256 to create a key
    key = hashlib.sha256(password_bytes).digest()
    keyhash = base64.b64encode(hashlib.sha256(key).digest()).decode()
    return key, keyhash  # Return raw key (32 bytes for AES-256)

def encrypt_file(file_path, key):
    """Encrypt a file using AES in CBC mode."""
    with open(file_path, 'rb') as file:
        data = file.read()

    iv = os.urandom(16)  # AES block size is 16 bytes
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()

    # Pad data to be a multiple of block size (16 bytes)
    pad_size = 16 - len(data) % 16
    padded_data = data + bytes([pad_size]) * pad_size

    encrypted_data = encryptor.update(padded_data) + encryptor.finalize()
    combined = iv + encrypted_data
    base64_encrypted = base64.b64encode(combined).decode('utf-8')

    with open(file_path, 'wb') as file:
        file.write(base64_encrypted.encode('utf-8'))  # Write as Base64 string

def encrypt_directory(directory, key):
    """Encrypt all files in a directory."""
    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)
        if os.path.isfile(file_path):
            encrypt_file(file_path, key)
            print(f'Encrypted: {file_path}')
        else:
            encrypt_directory(file_path, key)

def index(directory, chunk_size = 10000):
    """Create a directory structure based on JSON files."""
    guilds = {}
    
    # Check for JSON files in the specified directory
    for filename in os.listdir(directory):
        if filename.endswith('.json'):
            file_path = os.path.join(directory, filename)
            with open(file_path, 'r') as file:
                data = json.load(file)
                guild_id = data["guild"]["id"]
                category_id = data["channel"]["categoryId"]
                channel_id = data["channel"]["id"]
                channel_name = data["channel"]["name"]
                channel_topic = data["channel"]["topic"]
                messages = data["messages"]

                # Check and create guild if it doesn't exist
                if guild_id not in guilds:
                    guilds[guild_id] = {
                        "name": data["guild"]["name"],
                        "icon": data["guild"]["iconUrl"],
                        "categories": { "channels": { } },
                        "emojis": {},
                    }

                channel = { 
                    'key': None,
                    'chunks': (len(messages) + chunk_size - 1) // chunk_size,
                    'name': channel_name,
                    'topic':  channel_topic,
                    'messages': len(messages),
                }
                if category_id == '0': 
                    category_id = "channels"
                    guilds[guild_id]["categories"][category_id][channel_id] = channel
                else:
                    if category_id not in guilds[guild_id]["categories"]:
                        guilds[guild_id]["categories"][category_id] = {
                            "name": data["channel"]["category"],
                            "channels": {}
                        }

                    guilds[guild_id]["categories"][category_id]["channels"][channel_id] = channel

                for message in messages:
                    reactions = message['reactions']
                    for reaction in reactions:
                        if reaction['emoji']['name'] not in guilds[guild_id]['emojis']:
                            guilds[guild_id]['emojis'][reaction['emoji']['name']] = reaction['emoji']['imageUrl']

    return guilds

def restructure(directory, result_dir, chunk_size = 10000):
    guilds = index(directory)
    os.makedirs(result_dir, exist_ok=True)

    guild_ids = {}
    
    # Step 1: Create directories for guilds and move channel files into the guild directory
    for guild_id, guild_info in guilds.items():
        with open(os.path.join(result_dir, f'{guild_id}.json'), 'w') as f:
            json.dump(guild_info, f, indent=4)
        guild_ids[guild_id] = None
    
    with open(os.path.join(result_dir, 'index.json'), 'w') as f:
        json.dump(guild_ids, f, indent=4)
    
    # Step 2: Process channel files and split messages into chunks of 10,000
    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)
        if os.path.isfile(file_path) and filename.endswith('.json'):
            with open(file_path, 'r') as file:
                channel_data = json.load(file)
                channel_id = channel_data['channel']['id']
                messages = channel_data['messages']

                # Extract data before the messages array
                channel_metadata = {
                    "map": {
                        'current': 0,
                        'chunks': (len(messages) + chunk_size - 1) // chunk_size,
                        'messages': len(messages),
                    },
                    "guild": channel_data['guild'],
                    "channel": channel_data['channel']
                }
                
                # Split messages into chunks
                total_chunks = (len(messages) + chunk_size - 1) // chunk_size
                for i in range(total_chunks):
                    channel_metadata['map']['current']=i
                    chunk_messages = messages[i*chunk_size:(i+1)*chunk_size]
                    chunk_data = {**channel_metadata, "messages": chunk_messages}

                    # Create a target directory for each chunk
                    target_directory = os.path.join(result_dir, channel_id)
                    os.makedirs(target_directory, exist_ok=True)
                    
                    # Save each chunk as 1.json, 2.json, etc.
                    target_file_path = os.path.join(target_directory, f"{i}.json")
                    with open(target_file_path, 'w') as chunk_file:
                        json.dump(chunk_data, chunk_file, indent=4)
                    
                    print(f'Restructured {file_path} into {target_file_path}')



def encrypt_all_files_in_directory(directory, password):
    """Encrypt all files in a specified directory."""
    key, keyhash = generate_key(password)
    #print(f'Key: {base64.b64encode(key).decode()}')  # For debugging, show the key in Base64
    encrypt_directory(directory, key)
    return keyhash

if __name__ == "__main__":
    directory = "source"
    result_dir = "servers"
    restructure(directory, result_dir)

    input("Press enter once you're done reviewing and editing the result")

    for guild in os.listdir(result_dir):
        guild_file = os.path.join(result_dir, guild)
        if os.path.isfile(guild_file) and guild.endswith(".json") and guild != "index.json":
            with open(guild_file, 'r') as file:
                data = json.load(file)
            password = input(f"Enter the password for [{guild}]{data['name']}: ")
            channels = data['categories']['channels']
            choice = input("Do you want to encrypt categories and uncotegorized channels individually?(y/n): ")
            for category in data['categories'].keys():
                if category == "channels":
                    for channel in data['categories'][category].keys():
                        ukey = ''
                        if choice == 'y': ukey = input(f"Provide a unique password for [{channel}]{channels[channel]['name']} or leave empty to use server's: ")
                        channel_dir = os.path.join(result_dir, channel)
                        if ukey.strip():
                            data['categories']['channels'][channel]['key'] = encrypt_all_files_in_directory(channel_dir, ukey)
                        else:
                            data['categories']['channels'][channel]['key'] = encrypt_all_files_in_directory(channel_dir, password)
                else: 
                    ukey = ''
                    if choice == 'y': ukey = input(f"Provide a unique password for [{category}]{data['categories'][category]['name']} or leave empty to use server's: ")
                    for channel in data['categories'][category]['channels'].keys():
                        channel_dir = os.path.join(result_dir, channel)
                        if ukey.strip():
                            data['categories'][category]['channels'][channel]['key'] = encrypt_all_files_in_directory(channel_dir, ukey)
                        else:
                            data['categories'][category]['channels'][channel]['key'] = encrypt_all_files_in_directory(channel_dir, password)
            with open(guild_file, 'w') as f:
                json.dump(data, f, indent=4)

            guild_key, guild_hash = generate_key(password)
            encrypt_file(guild_file, guild_key)

            with open(os.path.join(result_dir, "index.json"), 'r') as f:
                idx = json.load(f)
                idx[guild[:-5]] = guild_hash
            with open(os.path.join(result_dir, "index.json"), 'w') as f:
                json.dump(idx, f, indent=4)
                

    # Encrypt files in the directory (this assumes files exist in the directory
