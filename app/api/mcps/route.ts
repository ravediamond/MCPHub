import { NextRequest, NextResponse } from 'next/server';
import { supabase } from 'lib/supabaseClient';
import { fetchComprehensiveRepoData } from 'services/githubService';
import { MCP } from 'types/mcp';
import { validateApiKey } from 'utils/apiKeyValidation'; // Import validation utility

// --- GET Handler ---
export async function GET(request: NextRequest) {
  // Optional: Add API key validation if this endpoint needs protection
  const searchParams = request.nextUrl.searchParams;
  const tokenParam = searchParams.get('token'); // Check for token if required by initializeServer

  // Example check if validation is needed - adjust environment variable name as needed
  const apiKeyRequired = process.env.MCP_API_KEY_REQUIRED === 'true';

  if (apiKeyRequired) {
    if (!tokenParam) {
      console.error('GET /api/mcps: Unauthorized - Missing API key');
      return NextResponse.json({ error: 'Unauthorized: Missing API key' }, { status: 401 });
    }
    const validationResult = await validateApiKey(tokenParam);
    if (!validationResult.valid) {
      console.error('GET /api/mcps: Unauthorized - Invalid API key');
      return NextResponse.json({ error: 'Unauthorized: Invalid API key' }, { status: 401 });
    }
    console.log('GET /api/mcps: API Key validated successfully');
  }

  try {
    console.log("GET /api/mcps: Fetching all MCPs from database...");
    const { data: mcps, error } = await supabase
      .from('mcps')
      .select('*') // Select all columns
      .order('created_at', { ascending: false }); // Optional: order by creation date

    if (error) {
      console.error("GET /api/mcps: Error fetching MCPs:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log(`GET /api/mcps: Retrieved ${mcps?.length || 0} MCPs from database`);
    // Return data under 'mcps' key, consistent with initializeServer expectation
    return NextResponse.json({ mcps: mcps || [] }, { status: 200 });

  } catch (error) {
    console.error('GET /api/mcps: Error fetching MCPs:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}


// --- POST Handler ---
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Validate required fields
    const { name, description, repository_url, author, user_id, tags } = body;
    if (!name || !repository_url || !author || !user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, repository_url, author, and user_id' },
        { status: 400 }
      );
    }

    // Validate GitHub URL format
    if (!repository_url.match(/^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/i)) {
      return NextResponse.json(
        { error: 'Invalid GitHub repository URL format' },
        { status: 400 }
      );
    }

    // Prepare the initial MCP object
    const mcpData: MCP = {
      name,
      description: description || '',
      repository_url,
      author,
      user_id,
      tags: tags || []
    };

    // Fetch comprehensive GitHub data
    try {
      console.log('Fetching GitHub data for repository:', repository_url);
      const repoData = await fetchComprehensiveRepoData(repository_url);

      // Enrich the MCP with GitHub data
      mcpData.readme = repoData.readme;
      mcpData.owner_username = repoData.owner;
      mcpData.repository_name = repoData.repo;
      mcpData.stars = repoData.stars;
      mcpData.forks = repoData.forks;
      mcpData.open_issues = repoData.open_issues;
      mcpData.last_repo_update = repoData.last_repo_update;
      mcpData.languages = repoData.languages;
      mcpData.last_refreshed = new Date().toISOString();

      console.log(`GitHub data fetched successfully. Stars: ${repoData.stars}, Languages: ${repoData.languages.join(', ')}`);
    } catch (e) {
      console.error('Error fetching GitHub data:', e);

      // Still extract basic owner/repo info even if GitHub API fails
      const parsedUrl = new URL(repository_url);
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);

      if (pathParts.length >= 2) {
        mcpData.owner_username = pathParts[0];
        mcpData.repository_name = pathParts[1];
      }
    }

    // Insert the new MCP record in Supabase
    const { data, error } = await supabase
      .from('mcps')
      .insert(mcpData)
      .select()
      .single();

    if (error) {
      // Check for duplicate repository_url constraint
      if (error.code === '23505' && error.message.includes('repository_url')) {
        return NextResponse.json(
          { error: 'An MCP with this GitHub repository URL already exists' },
          { status: 409 }
        );
      }

      console.error('Database insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Schedule a background task to refresh GitHub data if initial fetch failed
    if (!mcpData.stars && data.id) {
      try {
        // Use a background fetch to get stars count, but don't wait for it
        fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/mcps/refresh-stars?apiKey=${process.env.STARS_UPDATE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mcpIds: [data.id] })
        }).catch(err => console.error('Failed to schedule refresh for new MCP:', err));
      } catch (e) {
        console.error('Failed to schedule background refresh:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'MCP created successfully',
      mcp: data
    }, { status: 201 });
  } catch (error) {
    console.error('Error processing MCP creation:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}