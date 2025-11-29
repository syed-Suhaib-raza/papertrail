// app/(public)/about/page.tsx

export const metadata = {
  title: "About — papertrail.",
  description: "Learn about the mission, scope, and editorial process of papertrail.",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-10">

      <section className="space-y-3 mb-4">
        <h1 className="text-3xl font-semibold">About papertrail.</h1>
        <p className="text-gray-700 leading-relaxed">
          <span className="font-semibold">papertrail.</span> is a modern, digital-first academic 
          publishing platform designed to streamline peer-review, simplify workflows, 
          and improve the transparency of scholarly communication.  
        </p>
      </section>

      <section className="space-y-3 mb-4">
        <h2 className="text-2xl font-semibold">Our Mission</h2>
        <p className="text-gray-700 leading-relaxed">
          We aim to make high-quality research accessible, credible, and easy to publish. 
          Our mission is to support authors, reviewers, and editors with tools that 
          reduce administrative burden and let them focus on what matters: the research itself.
        </p>
      </section>

      <section className="space-y-3 mb-4">
        <h2 className="text-2xl font-semibold">Scope</h2>
        <p className="text-gray-700 leading-relaxed">
          papertrail. welcomes submissions across a wide range of disciplines.  
          We support empirical studies, theoretical work, literature reviews, case studies, 
          and exploratory research.  
        </p>
        <p className="text-gray-700 leading-relaxed">
          Our platform is designed to be flexible and adaptable, making it suitable for both 
          emerging researchers and established scholars.
        </p>
      </section>

      <section className="space-y-3 mb-4">
        <h2 className="text-2xl font-semibold">Editorial & Peer-Review Process</h2>
        <p className="text-gray-700 leading-relaxed">
          Every submission undergoes an initial editorial screening followed by 
          a structured peer-review workflow.  
        </p>
        <ul className="list-disc ml-6 text-gray-700 leading-relaxed">
          <li>Editors evaluate scope, suitability, and compliance.</li>
          <li>Reviewers provide detailed, constructive evaluations.</li>
          <li>Authors revise and resubmit based on reviewer feedback.</li>
          <li>Final decisions are made by the editorial board.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-semibold">Contact</h2>
        <p className="text-gray-700 leading-relaxed">
          For questions, feedback, or support, reach out at:
        </p>
        <p className="text-blue-600 font-medium">
          support@papertrail.example.com
        </p>
      </section>

    </div>
  );
}