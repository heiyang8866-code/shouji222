import fetch from 'node-fetch';

async function test() {
    const res = await fetch('https://yunwu.ai/v1/models', {
        headers: {
            'Authorization': 'Bearer YOUR_API_KEY'
        }
    });
    console.log(res.status);
}
test();
