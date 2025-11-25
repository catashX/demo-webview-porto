
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
        const { receive_id, image_key, receive_id_type = 'open_id' } = req.body;
        if (!receive_id || !image_key) {
            return res.status(400).json({ error: 'receive_id and image_key are required' });
        }

        const accessToken = await getAccessToken();

        const response = await fetch(`https://open.larksuite.com/open-apis/im/v1/messages?receive_id_type=${receive_id_type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                receive_id: receive_id,
                msg_type: 'image',
                content: JSON.stringify({
                    image_key: image_key
                })
            })
        });

        const data = await response.json();
        if (data.code !== 0) {
            throw new Error(`Failed to send image: ${JSON.stringify(data)}`);
        }

        res.status(200).json(data.data);

    } catch (error) {
        console.error('Send image error:', error);
        res.status(500).json({ error: error.message });
    }
}
