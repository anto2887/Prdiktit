// frontend/src/pages/TermsPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n';

const TERMS_COPY = {
  en: {
    title: 'Terms of Service',
    back: 'Back to Dashboard',
    sections: [
      {
        h: '1. Introduction',
        p: [
          'These Terms of Service govern your use of Prdiktit and related services.',
          'By creating an account or using the service, you agree to these Terms.',
        ],
      },
      {
        h: '2. Eligibility',
        p: ['You must be at least 18 years old to register, use the service, and be eligible for payouts.'],
      },
      {
        h: '3. Service Nature',
        p: [
          'Prdiktit is a football prediction game experience.',
          'It is not real-money betting or gambling.',
        ],
      },
      {
        h: '4. Coins, Purchases, and Refunds',
        p: [
          'Coins and power-ups are virtual items usable only inside Prdiktit.',
          'All purchases are final. No refunds are provided for coins or consumed power-ups, including duplicate same-day usage.',
        ],
      },
      {
        h: '5. Payout Verification',
        p: [
          'Prize payouts are processed via PayPal.',
          'Government-issued ID verification is required before payout approval.',
        ],
      },
      {
        h: '6. Fair Play and Enforcement',
        p: [
          'We may restrict or terminate accounts for fraud, abuse, botting, or manipulation of predictions/leaderboards.',
        ],
      },
      {
        h: '7. Liability and Availability',
        p: [
          'Service is provided "as is" and "as available".',
          'We do not guarantee uninterrupted availability or error-free operation.',
        ],
      },
      {
        h: '8. Governing Law',
        p: ['These Terms are governed by the laws of Colorado, USA.'],
      },
      {
        h: '9. Contact',
        p: ['For legal questions, contact: prdiktitadmin@prdiktit.com'],
      },
    ],
  },
  es: {
    title: 'Terminos del servicio',
    back: 'Volver al panel',
    sections: [
      {
        h: '1. Introduccion',
        p: [
          'Estos Terminos del servicio regulan el uso de Prdiktit y servicios relacionados.',
          'Al crear una cuenta o usar el servicio, aceptas estos Terminos.',
        ],
      },
      {
        h: '2. Elegibilidad',
        p: ['Debes tener al menos 18 anos para registrarte, usar el servicio y ser elegible para pagos.'],
      },
      {
        h: '3. Naturaleza del servicio',
        p: [
          'Prdiktit es una experiencia de predicciones de futbol.',
          'No es apuestas ni juego con dinero real.',
        ],
      },
      {
        h: '4. Monedas, compras y reembolsos',
        p: [
          'Las monedas y potenciadores son articulos virtuales de uso exclusivo dentro de Prdiktit.',
          'Todas las compras son finales. No hay reembolsos por monedas o potenciadores consumidos, incluido uso duplicado el mismo dia.',
        ],
      },
      {
        h: '5. Verificacion para pagos',
        p: [
          'Los pagos de premios se procesan mediante PayPal.',
          'Se requiere verificacion de identidad con documento oficial antes de aprobar un pago.',
        ],
      },
      {
        h: '6. Juego limpio y medidas',
        p: ['Podemos restringir o cerrar cuentas por fraude, abuso, bots o manipulacion de predicciones/clasificaciones.'],
      },
      {
        h: '7. Responsabilidad y disponibilidad',
        p: [
          'El servicio se ofrece "tal cual" y "segun disponibilidad".',
          'No garantizamos disponibilidad ininterrumpida ni funcionamiento sin errores.',
        ],
      },
      {
        h: '8. Ley aplicable',
        p: ['Estos Terminos se rigen por las leyes de Colorado, EE. UU.'],
      },
      {
        h: '9. Contacto',
        p: ['Para consultas legales: prdiktitadmin@prdiktit.com'],
      },
    ],
  },
  fr: {
    title: "Conditions d'utilisation",
    back: 'Retour au tableau de bord',
    sections: [
      {
        h: '1. Introduction',
        p: [
          "Ces Conditions d'utilisation regissent votre usage de Prdiktit et des services associes.",
          'En creant un compte ou en utilisant le service, vous acceptez ces Conditions.',
        ],
      },
      {
        h: '2. Eligibilite',
        p: ['Vous devez avoir au moins 18 ans pour creer un compte, utiliser le service et etre eligible aux paiements.'],
      },
      {
        h: '3. Nature du service',
        p: [
          'Prdiktit est une experience de pronostics football.',
          "Ce n'est pas un service de paris ou de jeux d'argent reel.",
        ],
      },
      {
        h: '4. Pieces, achats et remboursements',
        p: [
          "Les pieces et bonus sont des objets virtuels utilisables uniquement dans Prdiktit.",
          "Tous les achats sont definitifs. Aucun remboursement n'est accorde pour les pieces ou bonus consommes, y compris en cas d'usage duplique le meme jour.",
        ],
      },
      {
        h: '5. Verification des paiements',
        p: [
          'Les paiements de recompense sont traites via PayPal.',
          "Une verification d'identite avec piece officielle est requise avant validation du paiement.",
        ],
      },
      {
        h: '6. Jeu equitable et application',
        p: ['Nous pouvons restreindre ou suspendre les comptes en cas de fraude, abus, bots ou manipulation des pronostics/classements.'],
      },
      {
        h: '7. Responsabilite et disponibilite',
        p: [
          'Le service est fourni "en l\'etat" et "selon disponibilite".',
          "Nous ne garantissons pas une disponibilite ininterrompue ou un fonctionnement sans erreur.",
        ],
      },
      {
        h: '8. Droit applicable',
        p: ['Ces Conditions sont regies par les lois du Colorado (Etats-Unis).'],
      },
      {
        h: '9. Contact',
        p: ['Pour toute question legale: prdiktitadmin@prdiktit.com'],
      },
    ],
  },
  pt: {
    title: 'Termos de servico',
    back: 'Voltar ao painel',
    sections: [
      {
        h: '1. Introducao',
        p: [
          'Estes Termos de servico regem o uso do Prdiktit e servicos relacionados.',
          'Ao criar uma conta ou usar o servico, voce concorda com estes Termos.',
        ],
      },
      {
        h: '2. Elegibilidade',
        p: ['Voce deve ter pelo menos 18 anos para se cadastrar, usar o servico e ser elegivel a pagamentos.'],
      },
      {
        h: '3. Natureza do servico',
        p: [
          'Prdiktit e uma experiencia de previsoes de futebol.',
          'Nao e aposta ou jogo com dinheiro real.',
        ],
      },
      {
        h: '4. Moedas, compras e reembolsos',
        p: [
          'Moedas e power-ups sao itens virtuais de uso exclusivo dentro do Prdiktit.',
          'Todas as compras sao finais. Nao ha reembolso para moedas ou power-ups consumidos, inclusive uso duplicado no mesmo dia.',
        ],
      },
      {
        h: '5. Verificacao de pagamento',
        p: [
          'Pagamentos de premio sao processados via PayPal.',
          'Verificacao de identidade com documento oficial e obrigatoria antes da aprovacao do pagamento.',
        ],
      },
      {
        h: '6. Jogo limpo e aplicacao',
        p: ['Podemos restringir ou encerrar contas por fraude, abuso, bots ou manipulacao de previsoes/rankings.'],
      },
      {
        h: '7. Responsabilidade e disponibilidade',
        p: [
          'O servico e fornecido "como esta" e "conforme disponibilidade".',
          'Nao garantimos disponibilidade ininterrupta nem operacao sem erros.',
        ],
      },
      {
        h: '8. Lei aplicavel',
        p: ['Estes Termos sao regidos pelas leis do Colorado, EUA.'],
      },
      {
        h: '9. Contato',
        p: ['Para duvidas legais: prdiktitadmin@prdiktit.com'],
      },
    ],
  },
};

const TermsPage = () => {
  const { locale } = useI18n();
  const copy = TERMS_COPY[locale] || TERMS_COPY.en;
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

export default TermsPage;

