import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AppContext';
import { useGroups } from '../../contexts/AppContext';
import { useI18n } from '../../i18n';

const GroupInvite = () => {
    const { t } = useI18n();
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
            setMessage(t('groupInvite.sentSuccess'));
            setEmail('');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-md mx-auto bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">{t('groupInvite.title')}</h2>
                
                {message && (
                    <div className="bg-green-100 dark:bg-green-900/20 border border-green-400 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded mb-4">
                        {message}
                    </div>
                )}
                
                {error && (
                    <div className="bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleInvite}>
                    <div className="mb-4">
                        <label 
                            htmlFor="email" 
                            className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2"
                        >
                            {t('groupInvite.emailAddress')}
                        </label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="shadow appearance-none border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline"
                            placeholder={t('groupInvite.enterEmail')}
                            required
                        />
                    </div>

                    <div className="flex justify-between">
                        <button
                            type="submit"
                            className="bg-blue-500 dark:bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            {t('groupInvite.sendInvitation')}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/groups/${groupId}/manage`)}
                            className="bg-gray-500 dark:bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                        >
                            {t('groupInvite.backToManagement')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GroupInvite;