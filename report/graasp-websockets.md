<!--
    compilation :
    pandoc -V geometry:margin=2.5cm --variable urlcolor=cyan --number-sections -o report.pdf report.md
-->

---
header-includes:

 - \usepackage{fancyhdr}
 - \usepackage{multicol}
 - \usepackage{graphicx}
 - \pagestyle{fancy}
 - \fancyhead[CO,CE]{graasp-websockets}
 - \fancyfoot[CO,CE]{Alexandre CHAU - EPFL - REACT}
 - \fancyfoot[LE,RO]{\thepage}
 - \newcommand{\columnsbegin}{\begin{multicols*}{2}}
 - \newcommand{\columnsend}{\end{multicols*}}
---

\begin{titlepage}
	\centering
	\includegraphics[width=0.25\textwidth]{img/epfl-logo.png}\par
    {Interaction Systems Group (REACT)\par}
	\vspace{2.5cm}
	{\scshape\Large Master semester project\par}
	\vspace{1.5cm}
	{\huge\bfseries graasp-websockets\par}
	\vspace{0.5cm}
    {Real time content change notifications in a web based service\par using a full-duplex communication channel\par}
	\vspace{2cm}
	{\Large Alexandre CHAU\par}
	\vfill
	supervised by\par
	{\Large Dr. Denis \textsc{Gillet}\par}
	{\Large Dr. Nicolas \textsc{Macris}\par}
    {\Large André \textsc{Nogueira}\par}

	\vfill
	{\large \today\par}
\end{titlepage}

\tableofcontents

\newpage

\columnsbegin

# Abstract

\columnsend