// JoinGroup.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGroups, useNotifications } from '../../contexts/AppContext';
import LoadingSpinner from '../common/LoadingSpinner';
import { HelpTooltip } from '../onboarding/OnboardingGuide';
import { useI18n } from '../../i18n';

const JoinGroup = () => {
    const { t } = useI18n();
    const [inviteCode, setInviteCode] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { joinGroup } = useGroups();
    const { showSuccess, showError } = useNotifications();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!inviteCode.trim()) {
            showError(t('joinGroup.enterInviteCodeError'));
            return;
        }

        setLoading(true);
        try {
            const response = await joinGroup(inviteCode.trim());
            if (response) {
                showSuccess(t('joinGroup.joinSuccess'));
                navigate('/dashboard');
            }
        } catch (error) {
            showError(error.message || t('joinGroup.joinFailed'));
        } finally {
            setLoading(false);
        }
    };

    // Format invite code input (XXXX-XXXX)
    const handleInviteCodeChange = (e) => {
        let value = e.target.value.toUpperCase();
        value = value.replace(/[^A-Z0-9]/g, '');
        if (value.length > 8) {
            value = value.slice(0, 8);
        }
        setInviteCode(value);
    };

    if (loading) {
        return <LoadingSpinner />;
    }

    return (
        <div className="max-w-2xl mx-auto p-6">
            <div className="bg-white rounded-lg shadow-lg p-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">
                    {t('groups.joinLeague')}
                </h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label 
                                htmlFor="inviteCode" 
                                className="block text-sm font-medium text-gray-700"
                            >
                                {t('joinGroup.enterInviteCode')}
                            </label>
                            <HelpTooltip content={t('joinGroup.inviteHelp')}>
                                <span className="text-gray-400">ℹ️</span>
                            </HelpTooltip>
                        </div>
                        <input
                            id="inviteCode"
                            type="text"
                            value={inviteCode}
                            onChange={handleInviteCodeChange}
                            placeholder={t('joinGroup.enter8CharCode')}
                            className="w-full p-3 border rounded-md text-center tracking-wider uppercase"
                            maxLength={8}
                            required
                        />
                        <p className="mt-2 text-sm text-gray-500">
                            {t('joinGroup.enter8CharCodeBody')}
                        </p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || inviteCode.length !== 8}
                        className="w-full bg-blue-600 text-white p-3 rounded-md 
                                 hover:bg-blue-700 disabled:bg-gray-400 
                                 disabled:cursor-not-allowed"
                    >
                        {t('groups.joinLeague')}
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="w-full text-blue-600 hover:text-blue-800"
                    >
                        {t('joinGroup.backToDashboard')}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default JoinGroup;