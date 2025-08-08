import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useGroups } from '../../contexts/AppContext';

const GroupInvite = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();
    const { inviteToGroup } = useGroups();

    const handleInvite = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        try {
            await inviteToGroup(groupId, email);
            setMessage('Invitation sent successfully!');
            setEmail('');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-6">Invite User to Group</h2>
                
                {message && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                        {message}
                    </div>
                )}
                
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleInvite}>
                    <div className="mb-4">
                        <label 
                            htmlFor="email" 
                            className="block text-gray-700 text-sm font-bold mb-2"
                        >
                            Email Address
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder="Enter email address"
                            required
                        />
                    </div>

                    <div className="flex justify-between">
                        <button
                            type="submit"
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            Send Invitation
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/groups/${groupId}/manage`)}
                            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            Back to Management
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GroupInvite;