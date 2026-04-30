import React from 'react';
import SponsoredCard from './SponsoredCard';
import { adPlacements } from '../../utils/adConfig';

const AdSlot = ({ placement }) => {
  const config = adPlacements[placement];
  if (!config) return null;

  return (
    <div className="my-4">
      <SponsoredCard
        title={config.title}
        body={config.body}
        cta={config.cta}
        href={config.href}
      />
    </div>
  );
};

export default AdSlot;
