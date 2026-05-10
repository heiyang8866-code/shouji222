import fetch from 'node-fetch';

async function testStatus400() {
    const res = await fetch('https://yunwu.ai/v1/video/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer 1'
        },
        body: JSON.stringify({
            model: "grok-video-3",
            prompt: "a dog",
            size: "720P",
            aspect_ratio: "3:2"
        })
    });
    console.log(res.status, await res.text());
}
testStatus400();
