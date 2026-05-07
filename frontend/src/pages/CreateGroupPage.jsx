// src/pages/CreateGroupPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

// Components
import GroupForm from '../components/groups/GroupForm';
import { useI18n } from '../i18n';

const CreateGroupPage = () => {
  const { t } = useI18n();

  return (
    <div className="p-6">
      <div
        className="flex justify-between items-center mb-6"
        data-tour="tour-create-group-page-header"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('createGroup.title')}</h1>
        <Link
          to="/groups"
          className="text-blue-600 hover:text-blue-800"
        >
          ← {t('createGroup.backToLeagues')}
        </Link>
      </div>
      
      <GroupForm />
    </div>
  );
};

export default CreateGroupPage;