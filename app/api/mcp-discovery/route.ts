import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';
import { MCP } from 'types/mcp';

// Hardcoded API key for testing - same as in the SSE endpoint
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

    try {
        // Fetch MCPs from the database
        const { data: mcps, error } = await supabase
            .from('mcps')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Format MCPs according to MCP Protocol for discovery
        const formattedMcps = formatMCPsForProtocol(mcps || []);

        // Return formatted MCPs
        return NextResponse.json({
            mcps: formattedMcps,
            protocol_version: "1.0",
            server_info: {
                name: "MCPHub",
                version: "1.0.0",
                description: "MCPHub MCP Server"
            }
        }, { status: 200 });
    } catch (error) {
        console.error('Error in MCP discovery endpoint:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
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