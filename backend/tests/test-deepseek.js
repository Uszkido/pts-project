require('dotenv').config();

async function test() {
    console.log("Starting test...");
    const key = process.env.DEEPSEEK_API_KEY.trim();
    console.log("Key:", key.substring(0, 5) + "...");
    try {
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${key}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [{ role: "user", content: "hello" }],
                temperature: 0.7
            })
        });
        if (!response.ok) {
            console.error("Failed:", response.status, await response.text());
        } else {
            const data = await response.json();
            console.log("Success:", data.choices[0].message.content);
        }
    } catch (e) {
        console.error("Fetch Exception:", e);
    }
}
test();
