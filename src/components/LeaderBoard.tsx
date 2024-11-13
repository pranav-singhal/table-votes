"use client";

import { useSigner } from "@/hooks/useSigner";
import { Database } from "@tableland/sdk";
import { useEffect, useState } from "react";

interface ProjectScore {
    id: number;
    name: string;
    description: string;
    creator: string;
    created_at: number;
    upvotes: number;
    downvotes: number;
    score: number;
    rank: number;
}

interface LeaderBoardProps {
    projectsTable: string;
    votesTable: string;
}

export function LeaderBoard({ projectsTable, votesTable }: LeaderBoardProps) {
    const [projects, setProjects] = useState<ProjectScore[]>([]);
    const [loading, setLoading] = useState(false);
    const [timeFilter, setTimeFilter] = useState<"all" | "week" | "month">("all");
    const signer = useSigner();

    const fetchProjects = async () => {
        if (!projectsTable || !votesTable || !signer) return;

        try {
            setLoading(true);
            const db = new Database({ signer });

            // Time filter condition
            const timeCondition = timeFilter === "all"
                ? ""
                : timeFilter === "week"
                    ? `AND voted_at > ${Date.now() - 7 * 24 * 60 * 60 * 1000}`
                    : `AND voted_at > ${Date.now() - 30 * 24 * 60 * 60 * 1000}`;

            const { results } = await db
                .prepare(`
          SELECT 
            p.*,
            COALESCE(up.upvotes, 0) as upvotes,
            COALESCE(down.downvotes, 0) as downvotes,
            COALESCE(up.upvotes, 0) - COALESCE(down.downvotes, 0) as score
          FROM ${projectsTable} p
          LEFT JOIN (
            SELECT project_id, COUNT(*) as upvotes 
            FROM ${votesTable} 
            WHERE vote_type = 'up' ${timeCondition}
            GROUP BY project_id
          ) up ON p.id = up.project_id
          LEFT JOIN (
            SELECT project_id, COUNT(*) as downvotes 
            FROM ${votesTable} 
            WHERE vote_type = 'down' ${timeCondition}
            GROUP BY project_id
          ) down ON p.id = down.project_id
          ORDER BY score DESC, upvotes DESC, created_at DESC
        `)
                .all<ProjectScore>();

            // Add rank to projects
            const rankedProjects = results.map((project, index) => ({
                ...project,
                rank: index + 1
            }));

            setProjects(rankedProjects);
        } catch (err: any) {
            console.error("Error fetching leaderboard:", err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProjects();
    }, [projectsTable, votesTable, timeFilter]);

    const getRankEmoji = (rank: number) => {
        switch (rank) {
            case 1:
                return "🥇";
            case 2:
                return "🥈";
            case 3:
                return "🥉";
            default:
                return `#${rank}`;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Project Rankings</h2>
                <div className="flex space-x-2">
                    <select
                        value={timeFilter}
                        onChange={(e) => setTimeFilter(e.target.value as "all" | "week" | "month")}
                        className="bg-white border rounded px-2 py-1 text-sm text-black"
                    >
                        <option value="all">All Time</option>
                        <option value="week">This Week</option>
                        <option value="month">This Month</option>
                    </select>
                    <button
                        onClick={fetchProjects}
                        className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded text-sm"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-4">Loading...</div>
            ) : projects.length === 0 ? (
                <div className="text-center py-4 text-gray-500">No projects found</div>
            ) : (
                <div className="space-y-4">
                    {projects.map((project) => (
                        <div
                            key={project.id}
                            className={`bg-white rounded-lg p-4 shadow-md border-l-4 ${project.rank === 1
                                    ? 'border-yellow-400'
                                    : project.rank === 2
                                        ? 'border-gray-400'
                                        : project.rank === 3
                                            ? 'border-orange-600'
                                            : 'border-transparent'
                                }`}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex items-start space-x-4">
                                    <div className="text-2xl">{getRankEmoji(project.rank)}</div>
                                    <div>
                                        <h3 className="text-lg font-bold">{project.name}</h3>
                                        <p className="text-gray-600 mt-1">{project.description}</p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Created by: {project.creator.slice(0, 6)}...{project.creator.slice(-4)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold mb-1">
                                        Score: {project.score}
                                    </div>
                                    <div className="flex items-center space-x-3 text-sm">
                                        <span className="text-green-600">
                                            <span className="font-bold">{project.upvotes}</span> 👍
                                        </span>
                                        <span className="text-red-600">
                                            <span className="font-bold">{project.downvotes}</span> 👎
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
} 