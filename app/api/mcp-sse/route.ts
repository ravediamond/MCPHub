import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';
import { MCP } from 'types/mcp';

// Hardcoded API key for testing
const HARDCODED_API_KEY = "mcp-test-key-1234567890";

export async function GET(request: NextRequest) {
    // Validate API key
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '') ||
        request.nextUrl.searchParams.get('api_key');

    if (!apiKey || (apiKey !== HARDCODED_API_KEY && !await validateApiKey(apiKey))) {
        return NextResponse.json(
            { error: 'Unauthorized: Invalid API key' },
            { status: 401 }
        );
    }

    // Set headers for SSE
    const headers = new Headers({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked'
    });

    const encoder = new TextEncoder();

    // Create a readable stream for SSE
    const stream = new ReadableStream({
        async start(controller) {
            // Send initial keep-alive
            controller.enqueue(encoder.encode(': ping\n\n'));

            // Fetch MCPs from the database
            const { data: mcps, error } = await supabase
                .from('mcps')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`));
                controller.close();
                return;
            }

            // Format MCPs according to MCP Protocol
            const formattedMcps = formatMCPsForProtocol(mcps || []);

            // Send the MCPs as an SSE event
            controller.enqueue(encoder.encode(`event: mcps\ndata: ${JSON.stringify({ mcps: formattedMcps })}\n\n`));

            // Keep the connection open with periodic pings
            const pingInterval = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'));
                } catch (e) {
                    // Connection might be closed
                    clearInterval(pingInterval);
                }
            }, 30000); // Send ping every 30 seconds to keep connection alive

            // Cleanup function
            request.signal.addEventListener('abort', () => {
                clearInterval(pingInterval);
                controller.close();
            });
        }
    });

    return new Response(stream, { headers });
}

// Helper function to validate API key
async function validateApiKey(apiKey: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('key', apiKey)
        .single();

    if (error || !data) {
        return false;
    }

    // Check if the key is active and not expired
    const isActive = data.is_active;
    const isExpired = data.expires_at && new Date(data.expires_at) < new Date();

    return isActive && !isExpired;
}

// Helper function to format MCPs for the MCP Protocol
function formatMCPsForProtocol(mcps: MCP[]) {
    return mcps.map(mcp => ({
        id: mcp.id,
        name: mcp.name,
        description: mcp.description || '',
        version: "1.0",
        schema: {
            type: "github_repo",
            properties: {
                repository_url: mcp.repository_url,
                repository_name: mcp.repository_name,
                owner_username: mcp.owner_username,
                stars: mcp.stars || 0,
                tags: mcp.tags || []
            }
        },
        author: mcp.author,
        metadata: {
            created_at: mcp.created_at,
            last_refreshed: mcp.last_refreshed,
            view_count: mcp.view_count || 0,
            avg_rating: mcp.avg_rating || 0,
            review_count: mcp.review_count || 0,
            languages: mcp.languages || [],
            forks: mcp.forks || 0,
            open_issues: mcp.open_issues || 0
        }
    }));
}