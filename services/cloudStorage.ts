
const FILE_NAME = 'zehngah_user_data.json';

// Helper to parse response safely
async function parseResponse(response: Response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        return text;
    }
}

export const CloudStorageService = {
    // Find the file in the hidden App Data folder
    async findFile(accessToken: string) {
        try {
            const query = `name='${FILE_NAME}' and 'appDataFolder' in parents and trashed=false`;
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&spaces=appDataFolder&fields=files(id,modifiedTime)`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            
            if (!response.ok) throw new Error('Failed to search Drive');
            const data = await response.json();
            return data.files && data.files.length > 0 ? data.files[0] : null;
        } catch (error) {
            console.error("Drive Search Error:", error);
            throw error;
        }
    },

    // Download file content
    async downloadFile(fileId: string, accessToken: string) {
        try {
            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });
            if (!response.ok) throw new Error('Failed to download file');
            return await response.json();
        } catch (error) {
            console.error("Drive Download Error:", error);
            throw error;
        }
    },

    // Create new file in App Data folder
    async createFile(data: any, accessToken: string) {
        try {
            const metadata = {
                name: FILE_NAME,
                parents: ['appDataFolder'],
                mimeType: 'application/json'
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([JSON.stringify(data)], { type: 'application/json' }));

            const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                body: form
            });

            if (!response.ok) {
                const err = await parseResponse(response);
                console.error("Create File Error Body:", err);
                throw new Error('Failed to create file');
            }
            return await response.json();
        } catch (error) {
            console.error("Drive Create Error:", error);
            throw error;
        }
    },

    // Update existing file
    async updateFile(fileId: string, data: any, accessToken: string) {
        try {
            const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) throw new Error('Failed to update file');
            return await response.json();
        } catch (error) {
            console.error("Drive Update Error:", error);
            throw error;
        }
    }
};
