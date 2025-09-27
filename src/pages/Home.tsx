import { useEffect } from 'react';

import { useBreadcrumb } from '@/hooks/use-breadcrumb';

export default function Home() {
  const { setBreadcrumbs } = useBreadcrumb();

  useEffect(() => {
    setBreadcrumbs();
  }, [setBreadcrumbs]);

  return (
    <div className="bg-gradient-to-br from-background to-muted p-8">
      {/* Hero Section */}
      <section className="relative px-6 py-24 mx-auto max-w-7xl lg:px-8g">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
            Net<span className="text-primary">Play</span>
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-3xl mx-auto">
            Explorez et comprenez les protocoles de transport réseau à travers
            des simulations interactives. Trois étapes simples pour maîtriser
            les protocoles réseau
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">
                1
              </span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Choisissez un protocole
            </h3>
            <p className="text-muted-foreground">
              Sélectionnez Go-Back-N ou Selective Repeat selon ce que vous
              souhaitez apprendre
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">
                2
              </span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Configurez la simulation
            </h3>
            <p className="text-muted-foreground">
              Ajustez les paramètres comme la taille de la fenêtre et le taux de
              perte
            </p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">
                3
              </span>
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Observez et apprenez
            </h3>
            <p className="text-muted-foreground">
              Lancez la simulation et observez le comportement des paquets en
              temps réel
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
