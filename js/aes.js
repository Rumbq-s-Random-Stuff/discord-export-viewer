let key = null;

export function keyHash(password) {
    return CryptoJS.SHA256(CryptoJS.SHA256(password)).toString(CryptoJS.enc.Base64);
}

export function decrypt(encryptedData, password) {
    // Parse the encrypted data from Base64
    const parsedData = CryptoJS.enc.Base64.parse(encryptedData);
    
    // Extract the IV and the encrypted content
    const iv = parsedData.words.slice(0, 4); // First 16 bytes (4 words for 32 bytes)
    const encryptedContent = parsedData.words.slice(4); // Remaining bytes
    

    if (password) key = CryptoJS.SHA256(password).toString(CryptoJS.enc.Base64); // Generate key from password
    //console.log(key)

    // Decrypt the data
    const decryptedData = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.lib.WordArray.create(encryptedContent) }, 
        CryptoJS.enc.Base64.parse(key), 
        {
            iv: CryptoJS.lib.WordArray.create(iv),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        }
    );

    // Convert decrypted data to string
    return decryptedData.toString(CryptoJS.enc.Utf8);
}
