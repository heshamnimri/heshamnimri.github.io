import Image from "next/image";
import "./page.css";

export default function AboutPage() {
  return (
    <div className="about-section-align">
      <div>
        <div className="about-section">
          <h3>WHAT IS SHAM SHOTS MEDIA?</h3>
          <p>
            Sham Shots Media is a visual storytelling platform founded by
            photojournalist Hesham Nimri. Through the lens of documentary
            photography and film, we capture compelling narratives that bridge
            cultural understanding and shed light on underreported stories from
            around the world.
          </p>
          <p>
            Our work spans across continents, from the vibrant streets of Brazil
            to the political landscape of the United States, always seeking to
            uncover the human elements that connect us all.
          </p>
          <Image
              className="image-container-side"
              src="/photos/me.jpg"
              alt="Sham Shots Media"
              width={600}
              height={800}
            />
        </div>
        <div className="about-section">
          <h3>OUR WORK</h3>
          <p>
            We specialize in long-form visual storytelling, documentary
            photography, and photojournalism. Our projects focus on social
            issues, cultural documentation, and environmental stories that
            deserve attention and understanding.
          </p>
          <p>
            Recent work includes coverage of Brazil&apos;s dynamic social
            landscape, documentation of traditional communities in
            Len&ccedil;&oacute;is Maranhenses, and ongoing coverage of the 2024
            US election cycle.
          </p>
        </div>
        <div className="about-section">
          <h3>MISSION</h3>
          <p>
            Our mission is to create visual narratives that inspire empathy,
            understanding, and action. Through careful documentation and
            storytelling, we aim to bridge cultural gaps and bring important
            stories to light.
          </p>
        </div>
      </div>
    </div>
  );
}
