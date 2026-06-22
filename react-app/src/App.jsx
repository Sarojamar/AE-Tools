import { HashRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import PassportPhotoMaker from './pages/PassportPhotoMaker'
import FileConverter from './pages/FileConverter'
import IdCardPrinter from './pages/IdCardPrinter'
import ImageEnlarger from './pages/ImageEnlarger'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/passport-photo" element={<PassportPhotoMaker />} />
        <Route path="/file-converter" element={<FileConverter />} />
        <Route path="/id-card-printer" element={<IdCardPrinter />} />
        <Route path="/image-enlarger" element={<ImageEnlarger />} />
      </Routes>
    </HashRouter>
  )
}
