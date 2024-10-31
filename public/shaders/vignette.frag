#define PI 3.14159265359
#define RADIAN PI * 2.0

precision highp float;  
uniform sampler2D tDiffuse;
uniform float u_vignetteWidth;
//uniform float u_vignetteStart;
uniform float u_vignetteRadius;
uniform float u_vignetteShape;

varying vec2 vUv; 

// a function that returns the distance from a point to the edge of a rounded rectangle
float roundedRect(vec2 st, vec2 size, float radius) {
    // calculate the distance from the point to the center of the rectangle
    vec2 dist = abs(st - 0.5);
    // subtract the size of the rectangle from the distance
    dist = dist - size;
    // clamp the distance to zero if it is negative
    dist = max(dist, vec2(0.0));
    // calculate the length of the distance vector
    float len = length(dist);
    // subtract the radius from the length
    len = len - radius;
    // return the minimum of the length and the maximum component of the distance
    return min(len, max(dist.x, dist.y));
}

void main() 
{  
  	vec2 uv = vUv;

    vec2 rectCoord = uv;
    //rectCoord.x *= u_vignetteSize;

    vec2 camCoord = uv;
    //camCoord.x += 1.0 - 1.0 / u_vignetteSize;

    vec3 color = texture2D(tDiffuse, camCoord).rgb;
    // use the roundedRect function to create the shape
    float rect = roundedRect(rectCoord, vec2(u_vignetteShape), u_vignetteRadius); // you can change the size and radius here
    // use the mix function to create the smooth transition
    float mix = mix(0.0, 1.0, 1.0 - smoothstep(0.0, 1.0, rect / u_vignetteWidth));
    gl_FragColor = vec4(color * mix, 1.);
}