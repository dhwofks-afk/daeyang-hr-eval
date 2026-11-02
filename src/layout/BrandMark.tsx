// 회사 로고: 흰 원 위 원형 심벌 + "ROLLENT 대양롤랜트(주)" 글자 그림
// 둘 다 로고 원본(.ai)의 도형을 그대로 뽑은 SVG이고, 글자는 어두운 배경에 맞게 색만 흰색으로 바꿨다.
function BrandMark() {
  return (
    <>
      <span className="brand-mark">
        <img src="/logo-symbol.svg" alt="" />
      </span>
      <img className="brand-wordmark" src="/logo-wordmark.svg" alt="ROLLENT 대양롤랜트(주)" />
    </>
  )
}

export default BrandMark
