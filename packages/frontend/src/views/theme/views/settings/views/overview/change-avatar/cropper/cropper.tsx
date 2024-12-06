import React from 'react';
import { Cropper, ReactCropperElement } from 'react-cropper';
import 'cropperjs/dist/cropper.css';

export const CopperChangeAvatar = ({
  file,
  cropperRef,
}: {
  cropperRef: React.RefObject<null | ReactCropperElement>;
  file: File;
}) => {
  return (
    <Cropper
      aspectRatio={1}
      autoCropArea={1}
      background={false}
      checkOrientation={false}
      minCropBoxHeight={100}
      minCropBoxWidth={100}
      ref={cropperRef}
      rotatable={false}
      src={URL.createObjectURL(file)}
      style={{ height: 200, width: '100%' }}
      viewMode={1}
    />
  );
};
