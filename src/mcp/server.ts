import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MCP } from '../../types/mcp';

// Create a new MCP Server instance
export const server = new McpServer({
    name: 'MCPHub Server',
    version: '1.0.0',
    description: 'A hub for Model Context Protocol servers',
    authentication: {
        // This will ensure API keys/tokens work correctly
        supportsBearerAuth: true,
        supportsQueryParamAuth: true,
        authQueryParamName: 'token', // Match the parameter name used in the SSE endpoint
    },
});

// Register resources directly from the provided MCPs array
export async function registerResources(mcps: MCP[]) {
    mcps.forEach((mcp: MCP) => {
        server.resource(
            mcp.name,
            `mcp://${mcp.id}`, // Resource URI
            // Read callback function
            async () => ({
                contents: [{
                    uri: `mcp://${mcp.id}`,
                    text: JSON.stringify({
                        id: mcp.id,
                        repository_url: mcp.repository_url,
                        repository_name: mcp.repository_name || '',
                        owner_username: mcp.owner_username || '',
                        stars: mcp.stars || 0,
                        forks: mcp.forks || 0,
                        open_issues: mcp.open_issues || 0,
                        last_repo_update: mcp.last_repo_update || '',
                        readme: mcp.readme || '',
                        languages: mcp.languages || [],
                        tags: mcp.tags || [],
                        author: mcp.author,
                        view_count: mcp.view_count || 0,
                        avg_rating: mcp.avg_rating || 0,
                        review_count: mcp.review_count || 0,
                    }, null, 2)
                }]
            })
        );
    });
}

// Register prompts
export function registerPrompts() {
    // Search prompt
    server.prompt(
        "search",
        "Search for MCPs by query, tags, and limit",
        async (args) => {
            console.log("Search prompt received:", args);

            let query = '';
            let tags: string[] = [];
            let limit = 10;

            try {
                // Access parameters safely
                const params = args as any;
                query = String(params.query || '');
                tags = Array.isArray(params.tags) ? params.tags : [];
                limit = Number(params.limit || 10);
            } catch (e) {
                console.error("Error parsing parameters:", e);
            }

            // Use the existing search API endpoint via fetch
            const searchParams = new URLSearchParams();
            searchParams.append('q', query);
            if (tags && tags.length > 0) {
                searchParams.append('tags', tags.join(','));
            }
            searchParams.append('limit', String(limit));

            // Include token parameter for API key authentication
            const token = (args as any)?.token || 'mcp-test-key-1234567890'; // TODO: Use proper auth handling

            const apiUrl = `/api/search?${searchParams.toString()}&token=${token}`;

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`Search API returned ${response.status}`);
                }
                const results = await response.json();

                return {
                    messages: [
                        {
                            role: 'assistant',
                            content: {
                                type: 'text',
                                text: JSON.stringify(results.mcps, null, 2)
                            }
                        }
                    ]
                };
            } catch (error) {
                console.error('Error searching MCPs:', error);
                return {
                    messages: [
                        {
                            role: 'assistant',
                            content: {
                                type: 'text',
                                text: '[]' // Return empty array on error
                            }
                        }
                    ]
                };
            }
        }
    );

    // Featured MCPs prompt
    server.prompt(
        "featured",
        "Get featured MCPs by type and optional limit",
        async (args) => {
            console.log("Featured prompt received:", args);

            let type = 'trending';
            let limit = 5;

            try {
                // Access parameters safely
                const params = args as any;
                type = String(params.type || 'trending');
                limit = Number(params.limit || 5);
            } catch (e) {
                console.error("Error parsing parameters:", e);
            }

            // Include token parameter for API key authentication
            const token = (args as any)?.token || 'mcp-test-key-1234567890'; // TODO: Use proper auth handling

            const apiUrl = `/api/mcps/featured?type=${type}&limit=${limit}&token=${token}`;

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`Featured API returned ${response.status}`);
                }
                const results = await response.json();

                return {
                    messages: [
                        {
                            role: 'assistant',
                            content: {
                                type: 'text',
                                text: JSON.stringify(results.mcps, null, 2)
                            }
                        }
                    ]
                };
            } catch (error) {
                console.error('Error fetching featured MCPs:', error);
                return {
                    messages: [
                        {
                            role: 'assistant',
                            content: {
                                type: 'text',
                                text: '[]' // Return empty array on error
                            }
                        }
                    ]
                };
            }
        }
    );
}

// Register tools
export function registerTools() {
    // Tool for refreshing MCP data from GitHub
    server.tool(
        "refresh",
        { mcpId: z.string().describe('ID of the MCP to refresh') },
        async ({ mcpId }) => {
            const token = 'mcp-test-key-1234567890'; // TODO: Use proper auth handling
            const apiUrl = `/api/mcps/refresh?token=${token}`;

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mcpId }),
                });

                if (!response.ok) {
                    throw new Error(`Refresh API returned ${response.status}`);
                }

                const result = await response.json();
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ success: true, message: `MCP ${mcpId} refreshed`, ...result }, null, 2)
                    }]
                };
            } catch (error) {
                console.error('Error refreshing MCP:', error);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ success: false, message: String(error) }, null, 2)
                    }]
                };
            }
        }
    );

    // Tool for viewing an MCP (increments view count)
    server.tool(
        "view",
        { mcpId: z.string().describe('ID of the MCP to view') },
        async ({ mcpId }) => {
            const token = 'mcp-test-key-1234567890'; // TODO: Use proper auth handling
            const apiUrl = `/api/mcps/view?token=${token}`;

            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mcpId }),
                });

                if (!response.ok) {
                    throw new Error(`View API returned ${response.status}`);
                }

                const result = await response.json();
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ success: true, ...result }, null, 2)
                    }]
                };
            } catch (error) {
                console.error('Error viewing MCP:', error);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ success: false, message: String(error) }, null, 2)
                    }]
                };
            }
        }
    );

    // Tool for listing available MCPs
    server.tool(
        "list",
        {}, // No parameters for list
        async () => {
            const token = 'mcp-test-key-1234567890'; // TODO: Use proper auth handling
            const apiUrl = `/api/mcps?token=${token}`;

            try {
                const response = await fetch(apiUrl);
                if (!response.ok) {
                    throw new Error(`MCP API returned ${response.status}`);
                }
                const result = await response.json();
                // Assuming the list tool should return the list of *tools*, not MCPs
                // Adjust if this assumption is wrong.
                return {
                    content: [{
                        type: 'text',
                        // Example: Return the names of available tools
                        text: JSON.stringify({ success: true, tools: ["refresh", "view", "list"] }, null, 2)
                    }]
                };
            } catch (error) {
                console.error('Error listing tools (via MCPs endpoint):', error);
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({ success: false, message: String(error) }, null, 2)
                    }]
                };
            }
        }
    );
}

// Initialize the server by fetching MCPs and registering resources, prompts, and tools.
// This is intended for stateless operation where initialization happens per request or startup.
export async function initializeServer() {
    try {
        const baseUrl = typeof window !== 'undefined'
            ? window.location.origin
            : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        const token = 'mcp-test-key-1234567890'; // TODO: Use proper auth handling
        const apiUrlWithAuth = `${baseUrl}/api/mcps?token=${token}`;

        // Fetch MCPs to register them as resources
        const response = await fetch(apiUrlWithAuth);
        if (!response.ok) {
            throw new Error(`Failed to fetch MCPs for initialization: ${response.status}`);
        }

        const data = await response.json();
        const mcps = Array.isArray(data) ? data : data.mcps || [];

        // Register resources, prompts, and tools
        // Note: Re-registering on every call might be inefficient if state persists.
        // Consider checking if already initialized if this runs frequently.
        await registerResources(mcps);
        registerPrompts();
        registerTools();

        console.log("MCP server initialized successfully.");
        return server;
    } catch (error) {
        console.error('Error initializing MCP server:', error);
        // Return the server instance even on error, it might have partial setup.
        return server;
    }
}