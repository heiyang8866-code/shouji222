import fetch from 'node-fetch';

async function test() {
    const res = await fetch('https://yunwu.ai/v1/video/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer sk-fake'
        },
        body: JSON.stringify({
            model: "grok-video-3",
            prompt: "a dog",
            aspect_ratio: "16:9",
            size: "720P",
            duration: 6
        })
    });
    console.log(res.status, await res.text());
}
test();
