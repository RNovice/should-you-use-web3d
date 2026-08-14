import { Kicker, Title, Lead } from '../deck/ui';

/**
 * 封面。
 *
 * 刻意不在這裡講結論 —— 走「技術介紹＋如何引入」的口吻，
 * 讓聽眾先跟著看完證據再一起到達結論。
 */
const CoverBody = () => (
  <>
    <Kicker>技術研究</Kicker>
    <Title>Web 3D：技術原理與導入評估</Title>
    <Lead>
      三段：它是什麼、我們拿自己的產品試了什麼、以及什麼情況下值得引入。
    </Lead>
  </>
);

export const coverSlides = [
  {
    id: 'cover',
    section: '開場',
    scene: 'ambient',
    ambient: 'nebula',
    sec: 10,
    live: true,
    title: 'Web 3D：技術原理與導入評估',
    Body: CoverBody,
  },
];
