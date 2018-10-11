const path = require('path')

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.join(__dirname, 'public'),
    filename: "index.js",
  },
  resolve: {
    modules: ['node_modules', path.join(__dirname, './node_modules')],
    extensions: ['.js', '.jsx', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          { loader: 'style-loader' },
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              modules: true,              // 支持CSS模块
            },
          }
        ],
      },
      {
        test: /\.js?$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
        options: {                    // 配置额外的配置项
          presets: [                  // 在编译的时候，通过presets设置编译一些规则
            'es2015-ie',
            'react',                  // 支持react，需安装相应依赖包babel-preset-react
            'stage-0',                // 支持新的语法，需安装相应依赖包babel-preset-stage-0 
            [
              'env',                  // 在打包的过程中，根据环境做一些适配，需安装依赖包babel-preset-env
              {
                targets: {
                  browsers: ['last 2 versions']   // 打包编译的过程中，babel会去兼容目前所有主流浏览器的最后两个版本
                }
              }
            ]
          ]
        }
      }
    ]
  }
}