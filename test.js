
const config = require('C:\\Users\\xxwf\\AppData\\Roaming\\JetBrains\\IntelliJIdea2026.1\\plugins\\idea-claude-code-gui\\ai-bridge\\services\\claude\\mcp-status');

async function testToolCalling() {
    try {

        const bashTool = {
            name: "bash",
            params: { command: "ls -l", timeout: 3000 }
        };


        const response = await fetch(config.api.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...config.auth.headers,
                "Authorization": `Bearer ${process.env.TC_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [{role: "user", content: "列出文件"}],
                tools: [{
                    type: "function",
                    function: {
                        name: bashTool.name,
                        parameters: bashTool.params
                    }
                }]
            })
        });
        const result = await response.json();
        console.log("工具调用结果：", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("测试失败：", error);
    }
}

testToolCalling();