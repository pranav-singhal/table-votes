"use client";

import { useSigner } from "@/hooks/useSigner";
import { Database } from "@tableland/sdk";
import { useEffect, useState } from "react";

interface VoteButtonsProps {
    projectId: number;
    votesTable: string;
    creator: string;
    onVoteComplete?: () => void;
}

interface UserVote {
    vote_type: "up" | "down";
}

export function VoteButtons({ projectId, votesTable, creator, onVoteComplete }: VoteButtonsProps) {
    const [loading, setLoading] = useState(false);
    const signer = useSigner();
    const [userAddress, setUserAddress] = useState<string>("");
    const [userVote, setUserVote] = useState<UserVote | null>(null);

    // Get user's address when signer changes
    useEffect(() => {
        if (signer) {
            signer.getAddress().then(setUserAddress);
        }
    }, [signer]);

    // Check if user has already voted when component mounts or address changes
    useEffect(() => {
        const checkExistingVote = async () => {
            if (!signer || !votesTable || !userAddress) return;

            try {
                const db = new Database({ signer });
                const { results } = await db
                    .prepare(`SELECT vote_type FROM ${votesTable} WHERE project_id = ? AND voter = ?`)
                    .bind(projectId, userAddress)
                    .all<UserVote>();

                if (results.length > 0) {
                    setUserVote(results[0]);
                } else {
                    setUserVote(null);
                }
            } catch (err: any) {
                console.error("Error checking existing vote:", err.message);
            }
        };

        checkExistingVote();
    }, [signer, votesTable, projectId, userAddress]);

    const isCreator = userAddress.toLowerCase() === creator.toLowerCase();

    const handleVote = async (voteType: "up" | "down") => {
        if (!signer || !votesTable || isCreator || userVote) return;

        try {
            setLoading(true);
            const db = new Database({ signer });
            const voterAddress = await signer.getAddress();

            const { meta: vote } = await db
                .prepare(
                    `INSERT INTO ${votesTable} (project_id, voter, vote_type, voted_at) VALUES (?, ?, ?, ?);`
                )
                .bind(
                    projectId,
                    voterAddress,
                    voteType,
                    Date.now()
                )
                .run();

            await vote.txn?.wait();
            console.log(`${voteType} vote recorded for project ${projectId}`);

            // Update local state
            setUserVote({ vote_type: voteType });
            onVoteComplete?.();

        } catch (err: any) {
            console.error(`Error recording ${voteType} vote:`, err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeVote = async () => {
        if (!signer || !votesTable || !userVote) return;

        try {
            setLoading(true);
            const db = new Database({ signer });
            const voterAddress = await signer.getAddress();

            const { meta: revoke } = await db
                .prepare(
                    `DELETE FROM ${votesTable} WHERE project_id = ? AND voter = ?;`
                )
                .bind(projectId, voterAddress)
                .run();

            await revoke.txn?.wait();
            console.log(`Vote revoked for project ${projectId}`);

            // Update local state
            setUserVote(null);
            onVoteComplete?.();

        } catch (err: any) {
            console.error("Error revoking vote:", err.message);
        } finally {
            setLoading(false);
        }
    };

    const getVoteMessage = () => {
        if (isCreator) {
            return "You cannot vote on your own project";
        }
        if (!signer) {
            return "Connect your wallet to vote";
        }
        return null;
    };

    return (
        <div>
            <div className="flex space-x-2">
                {!userVote ? (
                    // Show vote buttons if user hasn't voted
                    <>
                        <button
                            onClick={() => handleVote("up")}
                            disabled={loading || !signer || isCreator}
                            className="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-3 rounded disabled:opacity-50"
                        >
                            👍 Upvote
                        </button>
                        <button
                            onClick={() => handleVote("down")}
                            disabled={loading || !signer || isCreator}
                            className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded disabled:opacity-50"
                        >
                            👎 Downvote
                        </button>
                    </>
                ) : (
                    // Show current vote and revoke button if user has voted
                    <>
                        <div className={`flex items-center px-3 py-1 rounded font-bold ${userVote.vote_type === "up"
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}>
                            {userVote.vote_type === "up" ? "👍 Upvoted" : "👎 Downvoted"}
                        </div>
                        <button
                            onClick={handleRevokeVote}
                            disabled={loading}
                            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded disabled:opacity-50"
                        >
                            Revoke Vote
                        </button>
                    </>
                )}
            </div>
            {getVoteMessage() && (
                <p className="text-sm text-gray-500 mt-2 italic">
                    {getVoteMessage()}
                </p>
            )}
        </div>
    );
} 