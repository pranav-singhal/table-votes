"use client";

import { useSigner } from "@/hooks/useSigner";
import { Database } from "@tableland/sdk";
import { useState } from "react";
import { VoteButtons } from "./VoteButtons";

// Table schemas
interface Project {
  id: number;
  name: string;
  description: string;
  creator: string;
  created_at: number;
  upvotes: number;
  downvotes: number;
}

interface Vote {
  id: number;
  project_id: number;
  voter: string;
  vote_type: "up" | "down";
  voted_at: number;
}

// Add a constant for the storage key
const STORAGE_KEY = "tableland_voting_tables";

export function Tableland() {
  // Modify the table name states to initialize from localStorage
  const [projectsTable, setProjectsTable] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      const tables = saved ? JSON.parse(saved) : {};
      return tables.projectsTable || undefined;
    }
    return undefined;
  });

  const [votesTable, setVotesTable] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      const tables = saved ? JSON.parse(saved) : {};
      return tables.votesTable || undefined;
    }
    return undefined;
  });

  // Add function to save tables to localStorage
  const saveTablestoStorage = (projectsTable?: string, votesTable?: string) => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projectsTable,
        votesTable,
      })
    );
  };

  // Store projects data
  const [projects, setProjects] = useState<Project[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const signer = useSigner();

  // Add new state for project creation form
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
  });
  const [activeTab, setActiveTab] = useState<"setup" | "create" | "view" | "permissions">("setup");

  // Add new state for permission management
  const [permissionAddress, setPermissionAddress] = useState("");

  // Add connection status display
  const getConnectionStatus = () => {
    if (!signer) {
      return <div className="text-red-500 mb-4">Please connect your wallet first</div>;
    }
    if (!projectsTable || !votesTable) {
      return <div className="text-yellow-500 mb-4">Please set up the tables in the Setup tab first</div>;
    }
    return null;
  };

  // Create both tables for the voting app
  async function createTables() {
    if (!signer) return;

    try {
      setLoading(true);
      const db = new Database({ signer });

      // Create projects table
      const { meta: createProjects } = await db
        .prepare(`CREATE TABLE projects (
          id integer primary key,
          name text not null,
          description text not null,
          creator text not null,
          created_at integer not null
        );`)
        .run();

      await createProjects.txn?.wait();
      const projectsTableName = createProjects.txn?.name;
      setProjectsTable(projectsTableName);

      // Create votes table 
      const { meta: createVotes } = await db
        .prepare(`CREATE TABLE votes (
          id integer primary key,
          project_id integer not null,
          voter text not null,
          vote_type text not null,
          voted_at integer not null,
          UNIQUE(project_id, voter)
        );`)
        .run();

      await createVotes.txn?.wait();
      const votesTableName = createVotes.txn?.name;
      setVotesTable(votesTableName);

      // Save both table names to localStorage
      saveTablestoStorage(projectsTableName, votesTableName);

      console.log(`Created tables: ${projectsTableName}, ${votesTableName}`);

    } catch (err: any) {
      console.error("Error creating tables:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Read all projects
  async function readProjects() {
    if (!projectsTable || !votesTable) return;

    try {
      setLoading(true);
      const db = new Database({ signer });

      const { results } = await db
        .prepare(`
          SELECT 
            p.*,
            COALESCE(up.upvotes, 0) as upvotes,
            COALESCE(down.downvotes, 0) as downvotes
          FROM ${projectsTable} p
          LEFT JOIN (
            SELECT project_id, COUNT(*) as upvotes 
            FROM ${votesTable} 
            WHERE vote_type = 'up' 
            GROUP BY project_id
          ) up ON p.id = up.project_id
          LEFT JOIN (
            SELECT project_id, COUNT(*) as downvotes 
            FROM ${votesTable} 
            WHERE vote_type = 'down' 
            GROUP BY project_id
          ) down ON p.id = down.project_id
        `)
        .all<Project>();

      setProjects(results);
      console.log("Projects with votes:", results);

    } catch (err: any) {
      console.error("Error reading projects:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Read all votes
  async function readVotes() {
    if (!votesTable) return;

    try {
      setLoading(true);
      const db = new Database({ signer });

      const { results } = await db
        .prepare(`SELECT * FROM ${votesTable}`)
        .all<Vote>();

      setVotes(results);
      console.log("Votes:", results);

    } catch (err: any) {
      console.error("Error reading votes:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Add new function to create a project
  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!projectsTable || !signer) return;

    try {
      setLoading(true);
      const db = new Database({ signer });

      const { meta: insert } = await db
        .prepare(
          `INSERT INTO ${projectsTable} (name, description, creator, created_at) VALUES (?, ?, ?, ?);`
        )
        .bind(
          newProject.name,
          newProject.description,
          await signer.getAddress(),
          Date.now()
        )
        .run();

      await insert.txn?.wait();
      console.log("Project created successfully");

      // Clear form
      setNewProject({ name: "", description: "" });
      // Refresh projects list
      await readProjects();

    } catch (err: any) {
      console.error("Error creating project:", err.message);
    } finally {
      setLoading(false);
    }
  }

  // Add handler for form inputs
  function handleProjectInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setNewProject(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  }

  // Add a function to clear tables (optional)
  const clearTables = () => {
    setProjectsTable(undefined);
    setVotesTable(undefined);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Add function to grant all permissions
  async function grantAllPermissions(address: string) {
    if (!signer || !projectsTable || !votesTable) return;

    try {
      setLoading(true);
      const db = new Database({ signer });

      // Grant all permissions for projects table
      const { meta: grantProjects } = await db
        .prepare(
          `GRANT INSERT, UPDATE, DELETE ON ${projectsTable} TO '${address}'`
        )
        .run();
      await grantProjects.txn?.wait();

      // Grant all permissions for votes table
      const { meta: grantVotes } = await db
        .prepare(
          `GRANT INSERT, UPDATE, DELETE ON ${votesTable} TO '${address}'`
        )
        .run();
      await grantVotes.txn?.wait();

      console.log(`Granted all permissions to ${address}`);
      setPermissionAddress(""); // Clear the input
    } catch (err: any) {
      console.error("Error granting permissions:", err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Voting App</h1>

      {/* Add connection status */}
      {getConnectionStatus()}

      {/* Tab Navigation */}
      <div className="flex mb-6 space-x-2">
        <button
          onClick={() => setActiveTab("setup")}
          className={`px-4 py-2 rounded ${activeTab === "setup"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 hover:bg-gray-300"
            }`}
        >
          Setup
        </button>
        <button
          onClick={() => setActiveTab("create")}
          disabled={!projectsTable}
          className={`px-4 py-2 rounded ${activeTab === "create"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 hover:bg-gray-300"
            } ${!projectsTable ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Create Project
        </button>
        <button
          onClick={() => setActiveTab("view")}
          disabled={!projectsTable}
          className={`px-4 py-2 rounded ${activeTab === "view"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 hover:bg-gray-300"
            } ${!projectsTable ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          View Projects
        </button>
        <button
          onClick={() => setActiveTab("permissions")}
          disabled={!projectsTable || !votesTable}
          className={`px-4 py-2 rounded ${activeTab === "permissions"
            ? "bg-blue-500 text-white"
            : "bg-gray-200 hover:bg-gray-300"
            } ${!projectsTable || !votesTable ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Permissions
        </button>
      </div>

      {/* Setup Tab */}
      {activeTab === "setup" && (
        <div className="mb-8">
          <div className="flex space-x-4">
            <button
              onClick={createTables}
              disabled={!signer || loading}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
            >
              Create Tables
            </button>
            {(projectsTable || votesTable) && (
              <button
                onClick={clearTables}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              >
                Clear Tables
              </button>
            )}
          </div>

          {(projectsTable || votesTable) && (
            <div className="space-y-4 mt-4">
              <h2 className="text-xl font-bold">Created Tables:</h2>
              {projectsTable && (
                <div className="p-4 bg-gray-100 rounded">
                  <p><span className="font-bold">Projects Table:</span> {projectsTable}</p>
                </div>
              )}
              {votesTable && (
                <div className="p-4 bg-gray-100 rounded">
                  <p><span className="font-bold">Votes Table:</span> {votesTable}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Project Tab */}
      {activeTab === "create" && (
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h2 className="text-xl font-bold mb-4">Create New Project</h2>
          {!signer ? (
            <div className="text-center p-4 bg-gray-100 rounded">
              Please connect your wallet to create a project
            </div>
          ) : !projectsTable ? (
            <div className="text-center p-4 bg-gray-100 rounded">
              Please set up the tables in the Setup tab first
            </div>
          ) : (
            <form onSubmit={createProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={newProject.name}
                  onChange={handleProjectInputChange}
                  required
                  className="w-full px-3 py-2 border rounded-md text-black"
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={newProject.description}
                  onChange={handleProjectInputChange}
                  required
                  className="w-full px-3 py-2 border rounded-md text-black"
                  rows={4}
                  placeholder="Enter project description"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !signer}
                className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              >
                Create Project
              </button>
            </form>
          )}
        </div>
      )}

      {/* View Projects Tab */}
      {activeTab === "view" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Projects</h2>
            <button
              onClick={readProjects}
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded text-sm"
            >
              Refresh
            </button>
          </div>
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="bg-white rounded-lg p-4 shadow-md">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold">{project.name}</h3>
                    <p className="text-gray-600 mt-2">{project.description}</p>
                    <div className="mt-2 text-sm text-gray-500">
                      <p>Created by: {project.creator.slice(0, 6)}...{project.creator.slice(-4)}</p>
                      <p>Created: {new Date(project.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center space-x-4">
                      <div className="text-green-600">
                        <span className="text-lg font-bold">{project.upvotes}</span>
                        <span className="ml-1">👍</span>
                      </div>
                      <div className="text-red-600">
                        <span className="text-lg font-bold">{project.downvotes}</span>
                        <span className="ml-1">👎</span>
                      </div>
                    </div>
                  </div>
                </div>
                {votesTable && (
                  <div className="mt-4">
                    <VoteButtons
                      projectId={project.id}
                      votesTable={votesTable}
                      creator={project.creator}
                      onVoteComplete={readProjects}
                    />
                  </div>
                )}
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-gray-500 text-center">
                {!projectsTable
                  ? "Please set up the tables first"
                  : "No projects found"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === "permissions" && (
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h2 className="text-xl font-bold mb-4">Manage Permissions</h2>
          {!signer ? (
            <div className="text-center p-4 bg-gray-100 rounded">
              Please connect your wallet to manage permissions
            </div>
          ) : !projectsTable || !votesTable ? (
            <div className="text-center p-4 bg-gray-100 rounded">
              Please set up the tables first
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Warning: Granting permissions will allow the address to perform all operations on the tables.
                      Make sure you trust the address.
                    </p>
                  </div>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  grantAllPermissions(permissionAddress);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Ethereum Address
                  </label>
                  <input
                    type="text"
                    value={permissionAddress}
                    onChange={(e) => setPermissionAddress(e.target.value)}
                    placeholder="0x..."
                    pattern="^0x[a-fA-F0-9]{40}$"
                    required
                    className="w-full px-3 py-2 border rounded-md text-black"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Enter the Ethereum address to grant permissions to
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={loading || !signer}
                  className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
                >
                  Grant All Permissions
                </button>
              </form>

              <div className="mt-6">
                <h3 className="font-bold mb-2">What permissions will be granted:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  <li>INSERT: Ability to add new records</li>
                  <li>UPDATE: Ability to modify existing records</li>
                  <li>DELETE: Ability to remove records</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
}
