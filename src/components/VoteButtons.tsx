"use client";

import { useSigner } from "@/hooks/useSigner";
import { Database } from "@tableland/sdk";
import { useState } from "react";

interface VoteButtonsProps {
    projectId: number;
    votesTable: string;
    creator: string;
    onVoteComplete?: () => void;
}

export function VoteButtons({ projectId, votesTable, creator, onVoteComplete }: VoteButtonsProps) {
    const [loading, setLoading] = useState(false);
    const signer = useSigner();
    const [userAddress, setUserAddress] = useState<string>("");

    useState(() => {
        if (signer) {
            signer.getAddress().then(setUserAddress);
        }
    });

    const isCreator = userAddress.toLowerCase() === creator.toLowerCase();

    const handleVote = async (voteType: "up" | "down") => {
        if (!signer || !votesTable || isCreator) return;

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

            onVoteComplete?.();

        } catch (err: any) {
            console.error(`Error recording ${voteType} vote:`, err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="flex space-x-2">
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
            </div>
            {isCreator && (
                <p className="text-sm text-gray-500 mt-2 italic">
                    You cannot vote on your own project
                </p>
            )}
        </div>
    );
} 