// frontend/src/pages/PrivacyPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

const PRIVACY_COPY = {
  en: {
    title: 'Privacy Policy',
    back: 'Back to Dashboard',
    sections: [
      {
        h: '1. Introduction',
        p: [
          'This Privacy Policy explains how Prdiktit collects, uses, and protects your information.',
          'By using the service, you agree to the practices described in this policy.',
        ],
      },
      {
        h: '2. Data We Collect',
        p: [
          'Account data (email, username, authentication metadata).',
          'Gameplay data (predictions, points, groups, rankings).',
          'Operational data (session identifiers, logs, anti-abuse records).',
          'Payment/compliance metadata (coin purchase events, payout verification status).',
        ],
      },
      {
        h: '3. How We Use Data',
        p: [
          'To run accounts, predictions, leaderboards, and wallet flows.',
          'To enforce legal/policy requirements including age eligibility (18+) and fraud controls.',
          'To support payout operations requiring identity verification before approval.',
        ],
      },
      {
        h: '4. Data Sharing',
        p: [
          'We do not sell personal data.',
          'We may share necessary data with infrastructure/payment/verification providers and as required by law.',
        ],
      },
      {
        h: '5. Retention and Security',
        p: [
          'We retain data as needed for service delivery, legal compliance, anti-fraud, and dispute resolution.',
          'We apply reasonable technical and organizational safeguards.',
        ],
      },
      {
        h: '6. Your Rights',
        p: [
          'Depending on your jurisdiction, you may request access, correction, or deletion of personal data.',
        ],
      },
      {
        h: '7. Contact',
        p: ['For privacy requests: prdiktitadmin@prdiktit.com'],
      },
    ],
  },
  es: {
    title: 'Politica de privacidad',
    back: 'Volver al panel',
    sections: [
      {
        h: '1. Introduccion',
        p: [
          'Esta Politica de privacidad explica como Prdiktit recopila, usa y protege tu informacion.',
          'Al usar el servicio, aceptas las practicas descritas en esta politica.',
        ],
      },
      {
        h: '2. Datos que recopilamos',
        p: [
          'Datos de cuenta (correo, usuario, metadatos de autenticacion).',
          'Datos de juego (predicciones, puntos, grupos, rankings).',
          'Datos operativos (identificadores de sesion, logs, registros antiabuso).',
          'Metadatos de pago/cumplimiento (compras de monedas, estado de verificacion para pagos).',
        ],
      },
      {
        h: '3. Como usamos los datos',
        p: [
          'Para operar cuentas, predicciones, clasificaciones y billetera.',
          'Para aplicar requisitos legales y de politica, incluida elegibilidad por edad (18+) y controles antifraude.',
          'Para operar pagos de premios que requieren verificacion de identidad antes de la aprobacion.',
        ],
      },
      {
        h: '4. Comparticion de datos',
        p: [
          'No vendemos datos personales.',
          'Podemos compartir datos necesarios con proveedores de infraestructura/pagos/verificacion y cuando la ley lo exija.',
        ],
      },
      {
        h: '5. Retencion y seguridad',
        p: [
          'Conservamos datos segun sea necesario para el servicio, cumplimiento legal, antifraude y resolucion de disputas.',
          'Aplicamos medidas tecnicas y organizativas razonables.',
        ],
      },
      {
        h: '6. Tus derechos',
        p: ['Segun tu jurisdiccion, puedes solicitar acceso, correccion o eliminacion de tus datos personales.'],
      },
      {
        h: '7. Contacto',
        p: ['Para solicitudes de privacidad: prdiktitadmin@prdiktit.com'],
      },
    ],
  },
  fr: {
    title: 'Politique de confidentialite',
    back: 'Retour au tableau de bord',
    sections: [
      {
        h: '1. Introduction',
        p: [
          'Cette Politique de confidentialite explique comment Prdiktit collecte, utilise et protege vos informations.',
          "En utilisant le service, vous acceptez les pratiques decrites dans cette politique.",
        ],
      },
      {
        h: '2. Donnees collectees',
        p: [
          'Donnees de compte (e-mail, nom utilisateur, metadonnees d\'authentification).',
          'Donnees de jeu (pronostics, points, groupes, classements).',
          'Donnees operationnelles (identifiants de session, journaux, traces anti-abus).',
          'Metadonnees paiement/conformite (achats de pieces, statut de verification des paiements).',
        ],
      },
      {
        h: '3. Utilisation des donnees',
        p: [
          'Pour faire fonctionner les comptes, pronostics, classements et portefeuille.',
          'Pour appliquer les exigences legales et de politique, y compris l\'eligibilite d\'age (18+) et les controles anti-fraude.',
          'Pour les paiements de recompense exigeant une verification d\'identite avant approbation.',
        ],
      },
      {
        h: '4. Partage des donnees',
        p: [
          'Nous ne vendons pas de donnees personnelles.',
          'Nous pouvons partager les donnees necessaires avec des prestataires d\'infrastructure/paiement/verification et lorsque la loi l\'exige.',
        ],
      },
      {
        h: '5. Conservation et securite',
        p: [
          'Nous conservons les donnees selon les besoins du service, de la conformite legale, de l\'anti-fraude et de la resolution des litiges.',
          'Nous appliquons des mesures techniques et organisationnelles raisonnables.',
        ],
      },
      {
        h: '6. Vos droits',
        p: [
          'Selon votre juridiction, vous pouvez demander l\'acces, la correction ou la suppression de vos donnees personnelles.',
        ],
      },
      {
        h: '7. Contact',
        p: ['Pour les demandes de confidentialite: prdiktitadmin@prdiktit.com'],
      },
    ],
  },
  pt: {
    title: 'Politica de privacidade',
    back: 'Voltar ao painel',
    sections: [
      {
        h: '1. Introducao',
        p: [
          'Esta Politica de privacidade explica como o Prdiktit coleta, usa e protege suas informacoes.',
          'Ao usar o servico, voce concorda com as praticas descritas nesta politica.',
        ],
      },
      {
        h: '2. Dados que coletamos',
        p: [
          'Dados de conta (e-mail, usuario, metadados de autenticacao).',
          'Dados de jogo (previsoes, pontos, grupos, rankings).',
          'Dados operacionais (identificadores de sessao, logs, registros antiabuso).',
          'Metadados de pagamento/conformidade (eventos de compra de moedas, status de verificacao para pagamentos).',
        ],
      },
      {
        h: '3. Como usamos os dados',
        p: [
          'Para operar contas, previsoes, classificacoes e carteira.',
          'Para aplicar exigencias legais e de politica, incluindo elegibilidade por idade (18+) e controles antifraude.',
          'Para suportar pagamentos de premios com verificacao de identidade antes da aprovacao.',
        ],
      },
      {
        h: '4. Compartilhamento de dados',
        p: [
          'Nao vendemos dados pessoais.',
          'Podemos compartilhar dados necessarios com provedores de infraestrutura/pagamento/verificacao e quando exigido por lei.',
        ],
      },
      {
        h: '5. Retencao e seguranca',
        p: [
          'Retemos dados conforme necessario para entrega do servico, conformidade legal, antifraude e resolucao de disputas.',
          'Aplicamos medidas tecnicas e organizacionais razoaveis de protecao.',
        ],
      },
      {
        h: '6. Seus direitos',
        p: [
          'Dependendo da sua jurisdicao, voce pode solicitar acesso, correcao ou exclusao de dados pessoais.',
        ],
      },
      {
        h: '7. Contato',
        p: ['Para solicitacoes de privacidade: prdiktitadmin@prdiktit.com'],
      },
    ],
  },
};

const PrivacyPage = () => {
  const { locale } = useI18n();
  const copy = PRIVACY_COPY[locale] || PRIVACY_COPY.en;
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{copy.title}</h1>
          </div>
          <Link
            to="/dashboard"
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            ← {copy.back}
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8 text-sm text-gray-800">
        {copy.sections.map((section) => (
          <section key={section.h}>
            <h2 className="text-lg font-semibold mb-2">{section.h}</h2>
            {section.p.map((line) => (
              <p key={line} className="mb-2">
                {line}
              </p>
            ))}
          </section>
        ))}
      </main>
    </div>
  );
};

export default PrivacyPage;

