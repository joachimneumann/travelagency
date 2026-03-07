const purgecss = require("@fullhuman/postcss-purgecss");

const isProduction = process.env.NODE_ENV === "production";

module.exports = {
  plugins: [
    require("tailwindcss")({ config: "./tailwind.config.cjs" }),
    require("autoprefixer"),
    ...(isProduction
      ? [
          purgecss({
            content: ["../frontend/pages/**/*.html", "../frontend/scripts/**/*.js"],
            defaultExtractor: (content) => content.match(/[A-Za-z0-9-_:/]+/g) || []
          })
        ]
      : [])
  ]
};
