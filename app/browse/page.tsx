'use client';

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
    MagnifyingGlassIcon,
    Squares2X2Icon,
    Bars3Icon,
    XMarkIcon,
} from "@heroicons/react/24/outline";
import Button from "components/ui/Button";
import MCPCard from "components/MCPCard";
import { supabase } from "lib/supabaseClient";

// Tag interface to match our DB structure
interface Tag {
    id: number;
    name: string;
    description?: string;
    icon?: string;
    category_id: number;
    tag_category?: {
        id: number;
        name: string;
    }
}

export default function BrowsePage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Initialize searchQuery with the value from URL if present.
    const initialQuery = searchParams.get("q") || "";
    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [view, setView] = useState<"grid" | "list">("grid");

    // Tags state
    const [deploymentTags, setDeploymentTags] = useState<Tag[]>([]);
    const [domainTags, setDomainTags] = useState<Tag[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [loadingTags, setLoadingTags] = useState(false);

    // State to store MCPs fetched from the API.
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch tags from the database
    useEffect(() => {
        async function fetchTags() {
            setLoadingTags(true);
            try {
                // Fetch deployment tags
                const { data: deploymentData, error: deploymentError } = await supabase
                    .rpc('get_tags_by_category', { category_name: 'deployment' });

                if (!deploymentError) {
                    setDeploymentTags(deploymentData || []);
                }

                // Fetch domain tags
                const { data: domainData, error: domainError } = await supabase
                    .rpc('get_tags_by_category', { category_name: 'domain' });

                if (!domainError) {
                    setDomainTags(domainData || []);
                }
            } catch (error) {
                console.error('Error fetching tags:', error);
            } finally {
                setLoadingTags(false);
            }
        }

        fetchTags();
    }, []);

    // Function to fetch items from the API.
    const fetchItems = async () => {
        setLoading(true);
        setError(null);
        try {
            const url = searchQuery.trim()
                ? `/api/search?q=${encodeURIComponent(searchQuery)}`
                : `/api/search`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.results) {
                setItems(data.results);
            } else {
                setError("No results found.");
            }
        } catch (err) {
            setError("Failed to fetch data.");
        } finally {
            setLoading(false);
        }
    };

    // Fetch data on initial render and when searchQuery changes.
    useEffect(() => {
        fetchItems();
    }, [searchQuery]);

    // Handler to update the URL search query.
    const handleSearch = () => {
        if (!searchQuery.trim()) {
            router.push("/browse");
        } else {
            router.push(`/browse?q=${encodeURIComponent(searchQuery)}`);
        }
    };

    // Trigger search on Enter key.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleSearch();
        }
    };

    // Toggle tag selection
    const toggleTag = (tag: string, prefix?: string) => {
        const tagWithPrefix = prefix ? `${prefix}:${tag}` : tag;
        setSelectedTags(prev =>
            prev.includes(tagWithPrefix)
                ? prev.filter(t => t !== tagWithPrefix)
                : [...prev, tagWithPrefix]
        );
    };

    // Clear all selected tags
    const clearTags = () => {
        setSelectedTags([]);
    };

    // Filter items by tags and search query
    const filteredItems = items.filter((item) => {
        // Filter by search query
        const matchesSearch =
            !searchQuery ||
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));

        // If no tags are selected, only filter by search
        if (selectedTags.length === 0) {
            return matchesSearch;
        }

        // Check if the item has the selected tags
        const hasSelectedTags = selectedTags.every(tag => {
            return item.tags && item.tags.includes(tag);
        });

        return matchesSearch && hasSelectedTags;
    });

    // Helper function to get deployment icon
    const getTagIcon = (tag: Tag) => {
        if (tag.icon) return tag.icon;
        return "";
    };

    return (
        <div className="bg-white min-h-screen">
            <div className="max-w-5xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-neutral-800 mb-2">
                        Browse Content
                    </h1>
                    <p className="text-neutral-600">
                        Discover and explore the latest content in our hub
                    </p>
                </div>

                {/* Search */}
                <div className="flex flex-col lg:flex-row gap-4 mb-6">
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            placeholder="Search for content..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full pl-12 pr-4 py-5 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-lg shadow-sm"
                        />
                        <MagnifyingGlassIcon
                            className="absolute left-4 top-5 h-6 w-6 text-neutral-400 cursor-pointer"
                            onClick={handleSearch}
                        />
                    </div>

                    <div className="flex gap-2 items-center">
                        <div className="flex items-center border border-neutral-200 rounded-lg">
                            <button
                                onClick={() => setView("grid")}
                                className={`p-2 rounded-l-lg ${view === "grid" ? "bg-blue-500 text-white" : "text-neutral-500"}`}
                            >
                                <Squares2X2Icon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setView("list")}
                                className={`p-2 rounded-r-lg ${view === "list" ? "bg-blue-500 text-white" : "text-neutral-500"}`}
                            >
                                <Bars3Icon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Deployment Tags Section - Highlighted as Important */}
                <div className="mb-4">
                    <h2 className="text-base font-semibold text-gray-700 mb-2">Deployment Type</h2>
                    <div className="flex flex-wrap gap-2">
                        {loadingTags ? (
                            <div className="w-full text-center py-2">
                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-blue-500 border-r-2 border-blue-500 border-b-2 border-blue-500 border-l-2 border-transparent"></div>
                            </div>
                        ) : deploymentTags.length > 0 ? (
                            deploymentTags.map((tag) => (
                                <button
                                    key={tag.id}
                                    onClick={() => toggleTag(tag.name, 'deployment')}
                                    className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm font-medium transition-colors
                                        ${selectedTags.includes(`deployment:${tag.name}`)
                                            ? 'bg-green-500 text-white border-green-500'
                                            : 'bg-white text-green-700 border-green-200 hover:bg-green-50'
                                        }`}
                                >
                                    {getTagIcon(tag)} {tag.name}
                                </button>
                            ))
                        ) : (
                            <span className="text-sm text-gray-500">No deployment types available</span>
                        )}
                    </div>
                </div>

                {/* Domain Tags */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-base font-semibold text-gray-700">Filter by Tag</h2>
                        {selectedTags.length > 0 && (
                            <button
                                onClick={clearTags}
                                className="text-sm text-blue-500 hover:text-blue-700 flex items-center"
                            >
                                <XMarkIcon className="h-4 w-4 mr-1" />
                                Clear filters
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-100 rounded-lg">
                        {loadingTags ? (
                            <div className="w-full text-center py-2">
                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-blue-500 border-r-2 border-blue-500 border-b-2 border-blue-500 border-l-2 border-transparent"></div>
                            </div>
                        ) : domainTags.length > 0 ? (
                            domainTags.map((tag) => (
                                <button
                                    key={tag.id}
                                    onClick={() => toggleTag(tag.name, 'domain')}
                                    className={`text-xs py-1 px-2 rounded-full border transition-colors
                                        ${selectedTags.includes(`domain:${tag.name}`)
                                            ? 'bg-blue-500 text-white border-blue-500'
                                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    {tag.name}
                                </button>
                            ))
                        ) : (
                            <span className="text-sm text-gray-500">No domain tags available</span>
                        )}
                    </div>
                </div>

                {/* Filter info */}
                {selectedTags.length > 0 && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                            <span className="font-medium">Active filters:</span> {selectedTags.map(tag => tag.replace(/^(domain|deployment):/, '')).join(', ')}
                        </p>
                    </div>
                )}

                {/* Display loading or error states */}
                {loading && <p className="text-center py-10">Loading...</p>}
                {error && <p className="text-red-500 text-center py-10">{error}</p>}

                {/* Content Grid / List using MCPCard */}
                <div
                    className={
                        view === "grid"
                            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                            : "flex flex-col gap-4"
                    }
                >
                    {filteredItems.length > 0 ? (
                        filteredItems.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <MCPCard
                                    mcp={item}
                                    onClick={() => {
                                        // Redirect to the MCP detail page
                                        router.push(`/mcp/${item.id}`);
                                    }}
                                    editable={true}
                                    onDelete={() => {
                                        // Remove the deleted item from state.
                                        setItems((prevItems) =>
                                            prevItems.filter((i) => i.id !== item.id)
                                        );
                                    }}
                                />
                            </motion.div>
                        ))
                    ) : (
                        !loading && <p className="text-center w-full col-span-full py-10">No results found.</p>
                    )}
                </div>

                {/* Pagination (if applicable) */}
                {filteredItems.length > 0 && (
                    <div className="mt-12 flex justify-center">
                        <nav className="inline-flex rounded-md shadow">
                            <a
                                href="#"
                                className="px-3 py-2 rounded-l-md border border-neutral-200 bg-white text-neutral-700 hover:bg-blue-50"
                            >
                                Previous
                            </a>
                            <a
                                href="#"
                                className="px-3 py-2 border-t border-b border-neutral-200 bg-blue-500 text-white"
                            >
                                1
                            </a>
                            <a
                                href="#"
                                className="px-3 py-2 border-t border-b border-neutral-200 bg-white text-neutral-700 hover:bg-blue-50"
                            >
                                2
                            </a>
                            <a
                                href="#"
                                className="px-3 py-2 border-t border-b border-neutral-200 bg-white text-neutral-700 hover:bg-blue-50"
                            >
                                3
                            </a>
                            <a
                                href="#"
                                className="px-3 py-2 rounded-r-md border border-neutral-200 bg-white text-neutral-700 hover:bg-blue-50"
                            >
                                Next
                            </a>
                        </nav>
                    </div>
                )}
            </div>
        </div>
    );
}
