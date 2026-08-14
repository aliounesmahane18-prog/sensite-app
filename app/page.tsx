import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 px-4 h-16 flex items-center justify-between">
        <span className="font-bold text-xl">SENsite<span className="text-orange-500">APP</span></span>
        <Link href="/login" className="btn-primary text-sm">Connexion boutique</Link>
      </nav>
      <section className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Ta boutique en ligne,{" "}
          <span className="text-orange-500">tes commandes sur WhatsApp</span> 📲
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          SENsite-APP donne à chaque boutique de Dakar son catalogue en ligne partageable.
          Les clients commandent, toi tu reçois directement sur WhatsApp.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <a href="https://wa.me/221767263361" target="_blank"
            className="btn-whatsapp text-base px-8 py-4">
            📲 Commander ma boutique
          </a>
          <Link href="/login" className="btn-secondary text-base px-8 py-4">
            Gérer ma boutique →
          </Link>
        </div>
      </section>
      <section className="py-16 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 grid sm:grid-cols-3 gap-6">
          {[
            { emoji: "📞", title: "Tu contactes Ali.IA", desc: "On crée ton compte et ton lien URL unique." },
            { emoji: "📸", title: "Tu ajoutes tes produits", desc: "Photos, noms, prix. Simple comme envoyer une story." },
            { emoji: "💬", title: "Les clients commandent", desc: "Ils voient ton catalogue et la commande arrive sur WhatsApp." },
          ].map((item) => (
            <div key={item.title} className="card p-6 text-center">
              <div className="text-4xl mb-3">{item.emoji}</div>
              <h3 className="font-bold text-lg mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="bg-gray-900 text-white py-8 text-center">
        <p className="font-bold mb-1">SENsite<span className="text-orange-500">APP</span></p>
        <p className="text-gray-400 text-sm">Développé par <span className="text-orange-400">Ali.IA Solutions</span> — Dakar 🇸🇳</p>
      </footer>
    </main>
  );
}
