
precision highp float;  
uniform float u_time;
uniform float u_timeMultX;
uniform float u_timeMultY;
uniform sampler2D u_tex;
uniform float u_alpha;
uniform float u_blurStrength;
uniform float u_vignetteWidth;
uniform float u_vignetteStart;
uniform bool u_isTextureGrad;

varying vec2 vUv; 

float circle(vec2 st, vec2 resolution, float radius)
{
    // Normalize st for aspect ratio
    vec2 aspectCorrect = st * resolution;
    aspectCorrect.x *= resolution.x / resolution.y;

    // Calculate distance from the center
    vec2 dist = aspectCorrect - vec2(0.5 * resolution.x, 0.5 * resolution.y);

    // Return the vignette effect based on the distance
    return 1.0 - smoothstep(radius - radius * u_vignetteWidth,
    radius + radius * u_vignetteWidth,
    dot(dist, dist * u_vignetteStart));
}

vec3 gradientBlur(vec2 uv, float strength)
{
    return textureGrad(u_tex, uv, strength*dFdx(uv), strength*dFdy(uv)).rgb;
}

vec3 simpleGaussian(vec2 uv, float strength)
{
    float a = 0.000229;
    float b = 0.005977;
    float c = 0.060598;
    float d = 0.241732;
    float e = 0.382928;
    float f = 0.241732;
    float g = 0.060598;
    float h = 0.005977;
    float i = 0.000229;

    vec2 blurX = vec2(strength * 0.01, 0.0) / 2.0;
    vec2 blurY = vec2(0.0, strength * 0.01) / 2.0;
    vec3 color = vec3(0);

    color += a * texture2D(u_tex, uv + blurX * -4.0).rgb;
    color += b * texture2D(u_tex, uv + blurX * -3.0).rgb;
    color += c * texture2D(u_tex, uv + blurX * -2.0).rgb;
    color += d * texture2D(u_tex, uv + blurX * -1.0).rgb;
    
    color += e * texture2D(u_tex, uv + blurX * 0.0).rgb;    
    color += f * texture2D(u_tex, uv + blurX * 1.0).rgb;
        color += g * texture2D(u_tex, uv + blurX * 2.0).rgb;
    color += h * texture2D(u_tex, uv + blurX * 3.0).rgb;
    color += i * texture2D(u_tex, uv + blurX * 4.0).rgb;

    color += a * texture2D(u_tex, uv + blurY * -4.0).rgb;
    color += b * texture2D(u_tex, uv + blurY * -3.0).rgb;
    color += c * texture2D(u_tex, uv + blurY * -2.0).rgb;
    color += d * texture2D(u_tex, uv + blurY * -1.0).rgb;
    // Skip the center sample since it's already added
    color += f * texture2D(u_tex, uv + blurY * 1.0).rgb;    
    color += g * texture2D(u_tex, uv + blurY * 2.0).rgb;    
    color += h * texture2D(u_tex, uv + blurY * 3.0).rgb;    
    color += i * texture2D(u_tex, uv + blurY * 4.0).rgb;    
    color /= (2.0 * (a + b + c + d) + e) * 2.0;
    return color;
}

void uvWave(inout vec2 uv)
{
    float amp = 0.05;
    float freq = 0.5;    
    uv.x = 0.5 * (1.0 + amp * sin(freq * uv.y + u_time * u_timeMultX)) + (1.0 - amp) * (uv.x - 0.5);
    uv.y = 0.5 * (1.0 + amp * sin(freq * uv.x + u_time * u_timeMultY)) + (1.0 - amp) * (uv.y - 0.5);

}

void main() 
{  
  	vec2 uv = vUv;

    float radius = 1.0;
    float vignette = circle(uv, vec2(1.0, 1.0), radius);
    
    uvWave(uv);    
    
    vec3 clrA = gradientBlur(uv, u_blurStrength * 1.0);
    vec3 clrB = simpleGaussian(uv, u_blurStrength * 0.2);
    vec3 clr = u_isTextureGrad ? clrA : clrB;
    gl_FragColor = vec4(clr, vignette * u_alpha);
}