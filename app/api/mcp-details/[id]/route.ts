import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';

// Hardcoded API key for testing - same as in other endpoints
const HARDCODED_API_KEY = "mcp-test-key-1234567890";

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // Validate API key
    const apiKey = request.headers.get('authorization')?.replace('Bearer ', '') ||
        request.nextUrl.searchParams.get('api_key');

    if (!apiKey || (apiKey !== HARDCODED_API_KEY && !await validateApiKey(apiKey))) {
        return NextResponse.json(
            { error: 'Unauthorized: Invalid API key' },
            { status: 401 }
        );
    }

    const id = params.id;

    if (!id) {
        return NextResponse.json({ error: 'MCP ID is required' }, { status: 400 });
    }

    try {
        // Fetch the MCP by ID
        const { data: mcp, error } = await supabase
            .from('mcps')
            .select(`
        *,
        profiles:user_id (
          email, 
          username
        )
      `)
            .eq('id', id)
            .single();

        if (error || !mcp) {
            return NextResponse.json(
                { error: 'MCP not found' },
                { status: 404 }
            );
        }

        // Fetch reviews for this MCP
        const { data: reviews, error: reviewsError } = await supabase
            .from('reviews')
            .select(`
        id,
        rating,
        comment,
        created_at,
        user_id,
        profiles:user_id (
          username, 
          email
        )
      `)
            .eq('mcp_id', id)
            .order('created_at', { ascending: false });

        if (reviewsError) {
            console.error('Error fetching reviews:', reviewsError);
        }

        // Format the MCP according to MCP Protocol
        const formattedMcp = {
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
                    tags: mcp.tags || [],
                    readme: mcp.readme || ''
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
                open_issues: mcp.open_issues || 0,
                last_repo_update: mcp.last_repo_update,
                default_branch: mcp.default_branch,
                reviews: reviews || []
            }
        };

        // Increment view count - fix the Promise handling
        try {
            await supabase
                .from('mcps')
                .update({ view_count: (mcp.view_count || 0) + 1 })
                .eq('id', id);

            console.log(`View count incremented for MCP ${id}`);
        } catch (err) {
            console.error(`Error incrementing view count: ${err}`);
        }

        // Return the formatted MCP
        return NextResponse.json(formattedMcp, { status: 200 });
    } catch (error) {
        console.error('Error fetching MCP details:', error);
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