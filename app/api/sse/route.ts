import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';
import { MCP } from 'types/mcp';
import { validateApiKey } from 'utils/apiKeyValidation';
// Adjust import path based on actual location
import { server, initializeServer } from '../../../src/mcp/server';

// Hardcoded API key for testing - consider moving to environment variables
const HARDCODED_API_KEY = "mcp-test-key-1234567890";

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Helper function to format MCPs for the MCP Protocol discovery response
// Adjust parameter type to match data fetched from Supabase
function formatMCPsForDiscovery(mcps: { id: string; name: string; description: string | null; author: string; tags: string[] | null; stars: number | null; }[]) {
    return mcps.map(mcp => ({
        id: mcp.id,
        name: mcp.name,
        description: mcp.description || '',
        author: mcp.author,
        metadata: {
            tags: mcp.tags || [],
            stars: mcp.stars || 0,
        }
    }));
}


export async function GET(request: NextRequest) {
    console.log("Manual SSE endpoint hit");

    // --- Authentication ---
    const authHeader = request.headers.get('authorization');
    const searchParams = request.nextUrl.searchParams;
    const tokenParam = searchParams.get('token');
    const apiKeyParam = searchParams.get('api_key');

    let apiKey = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.replace('Bearer ', '');
    } else if (tokenParam) {
        apiKey = tokenParam;
    } else if (apiKeyParam) {
        apiKey = apiKeyParam;
    }

    if (!apiKey) {
        console.error('SSE: Unauthorized - Missing API key');
        return NextResponse.json({ error: 'Unauthorized: Missing API key' }, { status: 401 });
    }

    let isValid = apiKey === HARDCODED_API_KEY;
    if (!isValid) {
        const validationResult = await validateApiKey(apiKey);
        isValid = validationResult.valid;
    }

    if (!isValid) {
        console.error('SSE: Unauthorized - Invalid API key');
        return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }
    console.log('SSE: API Key validated successfully');

    // --- Initialize MCP Server Logic (Fetch data, register resources/prompts/tools) ---
    try {
        // Initialize the server logic (registers prompts, tools, and potentially resources)
        await initializeServer();
        console.log('SSE: MCP Server logic initialized');

    } catch (error) {
        console.error('SSE: Failed to initialize MCP server logic:', error);
        return NextResponse.json(
            { error: 'Internal Server Error: Failed to initialize MCP server logic' },
            { status: 500 }
        );
    }

    // --- Manual SSE Stream Setup ---
    const headers = new Headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    const encoder = new TextEncoder();
    let pingInterval: NodeJS.Timeout | null = null;

    const stream = new ReadableStream({
        async start(controller) {
            console.log("SSE stream starting...");

            try {
                // --- Send Initial Discovery Message (Example) ---
                const { data: initialMcps, error: fetchError } = await supabase
                    .from('mcps')
                    .select('id, name, description, author, tags, stars') // Select only needed fields
                    .limit(20); // Limit initial payload

                if (fetchError) {
                    console.error("SSE: Error fetching initial MCPs for discovery:", fetchError);
                    controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "Failed to fetch initial data" })}\n\n`));
                    controller.close();
                    return;
                }

                // Construct the discovery payload
                // Removed server config access and prompt/tool listing causing errors
                const discoveryPayload = {
                    // server_info: { // Removed due to access error
                    //     name: server.config.name,
                    //     version: server.config.version,
                    //     description: server.config.description,
                    // },
                    resources: formatMCPsForDiscovery(initialMcps || []),
                    // prompts: server.listPrompts()... // Removed due to access error
                    // tools: server.listTools()... // Removed due to access error
                };

                // Send the discovery payload
                const jsonString = JSON.stringify(discoveryPayload);
                console.log("SSE: Sending initial discovery payload...");
                controller.enqueue(encoder.encode(`data: ${jsonString}\n\n`)); // Send as single data line
                console.log("SSE: Initial discovery payload sent.");

                // --- Keep Connection Alive ---
                pingInterval = setInterval(() => {
                    try {
                        controller.enqueue(encoder.encode(': ping\n\n'));
                    } catch (e) {
                        console.error("SSE: Error sending ping, closing connection:", e);
                        if (pingInterval) clearInterval(pingInterval);
                        try { controller.close(); } catch { }
                    }
                }, 15000);

                // --- Handle Client Disconnect ---
                request.signal.addEventListener('abort', () => {
                    console.log("SSE connection aborted by client.");
                    if (pingInterval) clearInterval(pingInterval);
                });

            } catch (error) {
                console.error("SSE: Error during stream start:", error);
                try {
                    controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: "Internal server error during SSE setup" })}\n\n`));
                } catch { }
                if (pingInterval) clearInterval(pingInterval);
                try { controller.close(); } catch { }
            }
        },
        cancel(reason) {
            console.log("SSE stream cancelled.", reason);
            if (pingInterval) clearInterval(pingInterval);
        }
    });

    console.log("SSE: Returning response with stream.");
    return new Response(stream, { headers });
}