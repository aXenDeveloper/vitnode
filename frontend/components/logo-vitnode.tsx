import { cx } from '@/functions/classnames';

interface Props {
  className?: string;
}

export const LogoVitNode = ({ className }: Props) => {
  return (
    <svg
      viewBox="0 0 546 129"
      className={cx('text-foreground', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M381.455 109H376.905L351.75 70.78V109H347.2V63.565H351.75L376.905 101.72V63.565H381.455V109ZM412.171 109.455C407.967 109.455 404.154 108.48 400.731 106.53C397.307 104.537 394.599 101.785 392.606 98.275C390.656 94.7217 389.681 90.7133 389.681 86.25C389.681 81.7867 390.656 77.8 392.606 74.29C394.599 70.7367 397.307 67.985 400.731 66.035C404.154 64.0417 407.967 63.045 412.171 63.045C416.417 63.045 420.252 64.0417 423.676 66.035C427.099 67.985 429.786 70.7367 431.736 74.29C433.686 77.8 434.661 81.7867 434.661 86.25C434.661 90.7133 433.686 94.7217 431.736 98.275C429.786 101.785 427.099 104.537 423.676 106.53C420.252 108.48 416.417 109.455 412.171 109.455ZM412.171 105.49C415.551 105.49 418.584 104.71 421.271 103.15C423.957 101.59 426.081 99.3583 427.641 96.455C429.201 93.5083 429.981 90.1067 429.981 86.25C429.981 82.3933 429.201 79.0133 427.641 76.11C426.081 73.2067 423.957 70.975 421.271 69.415C418.584 67.855 415.551 67.075 412.171 67.075C408.791 67.075 405.757 67.855 403.071 69.415C400.384 70.975 398.261 73.2067 396.701 76.11C395.141 79.0133 394.361 82.3933 394.361 86.25C394.361 90.1067 395.141 93.5083 396.701 96.455C398.261 99.3583 400.384 101.59 403.071 103.15C405.757 104.71 408.791 105.49 412.171 105.49ZM456.441 63.565C461.468 63.565 465.779 64.475 469.376 66.295C472.973 68.115 475.724 70.7367 477.631 74.16C479.538 77.5833 480.491 81.6567 480.491 86.38C480.491 91.06 479.538 95.1117 477.631 98.535C475.724 101.915 472.973 104.515 469.376 106.335C465.779 108.112 461.468 109 456.441 109H442.986V63.565H456.441ZM456.441 105.23C462.768 105.23 467.578 103.583 470.871 100.29C474.208 96.9533 475.876 92.3167 475.876 86.38C475.876 80.4 474.208 75.7417 470.871 72.405C467.578 69.025 462.768 67.335 456.441 67.335H447.536V105.23H456.441ZM493.43 67.27V84.235H510.655V88.005H493.43V105.23H512.605V109H488.88V63.5H512.605V67.27H493.43Z"
        fill="currentColor"
      />
      <path
        d="M240.288 19.144L208.416 109H181.024L149.152 19.144H172.448L194.72 86.984L217.12 19.144H240.288ZM271.324 19.144V109H249.436V19.144H271.324ZM351.826 19.144V36.68H328.018V109H306.13V36.68H282.322V19.144H351.826Z"
        fill="#0162C3"
      />
      <path
        d="M57.2653 1.76963C61.3535 -0.589876 66.3905 -0.589876 70.4787 1.76963L114.481 27.1653C118.57 29.5248 121.088 33.8853 121.088 38.6043V89.3957C121.088 94.1147 118.57 98.4752 114.481 100.835L70.4787 126.23C66.3905 128.59 61.3535 128.59 57.2653 126.23L13.2627 100.835C9.17448 98.4752 6.65601 94.1147 6.65601 89.3957V38.6043C6.65601 33.8853 9.17448 29.5248 13.2627 27.1653L57.2653 1.76963Z"
        fill="#FDFEFF"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M64 20.8764L26.5206 42.5022V85.7538L64 107.38L101.479 85.7538V42.5022L64 20.8764ZM70.6215 1.77317C66.5241 -0.591056 61.4759 -0.591056 57.3785 1.77317L13.2775 27.2196C9.18011 29.5838 6.65601 33.9531 6.65601 38.6815V89.5744C6.65601 94.3029 9.18011 98.6721 13.2775 101.036L57.3785 126.483C61.4759 128.847 66.5241 128.847 70.6215 126.483L114.722 101.036C118.82 98.6721 121.344 94.3029 121.344 89.5744V38.6815C121.344 33.9531 118.82 29.5838 114.722 27.2196L70.6215 1.77317Z"
        fill="#0162C3"
      />
      <path
        d="M92.8532 32.256L68.8089 73.9474C68.808 73.949 68.8071 73.9505 68.8062 73.952L64 82.2857L35.1468 32.256L25.5291 32.256C21.2545 32.256 18.5829 36.8884 20.7202 40.5943L59.1911 107.301C61.3284 111.006 66.6716 111.006 68.8089 107.301L107.28 40.5943C109.417 36.8884 106.745 32.256 102.471 32.256L92.8532 32.256Z"
        fill="#0162C3"
      />
    </svg>
  );
};
