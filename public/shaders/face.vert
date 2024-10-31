//#version 150

// these are for the programmable pipeline system and are passed in
// by default from OpenFrameworks
//uniform mat4 modelViewProjectionMatrix;

//in vec4 position;
varying vec2 vUv;

void main()
{
	vUv = uv;
	vec4 localPosition = vec4(position, 1.0);
	gl_Position = projectionMatrix * modelViewMatrix * localPosition;
}
