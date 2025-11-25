
// Get access token from Lark
async function getAccessToken() {
    const response = await fetch('https://open.larksuite.com/open-apis/auth/v3/app_access_token/internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            app_id: process.env.LARK_APP_ID,
            app_secret: process.env.LARK_APP_SECRET
        })
    });
    const data = await response.json();
    return data.app_access_token;
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '4mb', // Set limit for file upload
        },
    },
};

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image_base64, image_type = 'message' } = req.body;

        if (!image_base64) {
            return res.status(400).json({ error: 'image_base64 is required' });
        }

        const accessToken = await getAccessToken();

        // Convert base64 to Blob/Buffer
        const buffer = Buffer.from(image_base64.split(',')[1], 'base64');

        const form = new FormData();
        form.append('image_type', image_type);
        form.append('image', new Blob([buffer]), 'upload.jpg');

        const response = await fetch('https://open.larksuite.com/open-apis/im/v1/images', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                // Note: fetch with FormData automatically sets Content-Type with boundary
            },
            body: form
        });

        const data = await response.json();
        if (data.code !== 0) {
            throw new Error(`Failed to upload image: ${JSON.stringify(data)}`);
        }

        res.status(200).json(data.data);

    } catch (error) {
        console.error('Upload image error:', error);
        res.status(500).json({ error: error.message });
    }
}
