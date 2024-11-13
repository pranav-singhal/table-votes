"use client";

import { useSigner } from "@/hooks/useSigner";
import { Database } from "@tableland/sdk";
import { useEffect, useState } from "react";

interface TableDetailsProps {
    tableName: string;
    label: string;
}

export function TableDetails({ tableName, label }: TableDetailsProps) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const signer = useSigner();

    const fetchRows = async () => {
        if (!tableName || !signer) return;

        try {
            setLoading(true);
            const db = new Database({ signer });
            const { results } = await db
                .prepare(`SELECT * FROM ${tableName}`)
                .all();
            setRows(results);
        } catch (err: any) {
            console.error(`Error fetching rows from ${tableName}:`, err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isExpanded) {
            fetchRows();
        }
    }, [isExpanded, tableName]);

    const formatValue = (value: any) => {
        if (typeof value === 'number' && value > 1000000000) {
            return new Date(value).toLocaleString();
        }
        return String(value);
    };

    return (
        <div className="p-4 bg-gray-100 rounded">
            <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <p>
                    <span className="font-bold">{label}:</span> {tableName}
                </p>
                <button className="text-blue-500 hover:text-blue-700">
                    {isExpanded ? "▼" : "▶"}
                </button>
            </div>

            {isExpanded && (
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-semibold">Table Rows</h3>
                        <button
                            onClick={fetchRows}
                            className="text-sm bg-blue-500 hover:bg-blue-700 text-white px-2 py-1 rounded"
                        >
                            Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div className="text-center py-4">Loading...</div>
                    ) : rows.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">No rows found</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-white rounded-lg overflow-hidden shadow-sm">
                                <thead className="bg-gray-200">
                                    <tr>
                                        {Object.keys(rows[0]).map((key) => (
                                            <th key={key} className="px-4 py-2 text-left text-sm font-semibold text-gray-600">
                                                {key}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, i) => (
                                        <tr key={i} className="border-t">
                                            {Object.values(row).map((value, j) => (
                                                <td key={j} className="px-4 py-2 text-sm">
                                                    {formatValue(value)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
} 