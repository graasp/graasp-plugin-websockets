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
    {Real-time content change notifications in a web-based service\par using a full-duplex communication channel\par}
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

*Graasp* is a social media learning platform that provides an ecosystem of software applications for digital education. It is developed by the Coordination & Interaction Systems Group (REACT) at EPFL.

In late 2019, a major overhaul of the *Graasp* web software stack was initiated using state-of-the-art technologies. This modernization allows for the adoption of recent open standards such as WebSocket, which in turn enables the implementation of new classes of features including real-time bidirectional communications between clients and server.

This project provides real-time content change notifications in *Graasp* web-based services
using the WebSocket protocol as a full-duplex communication channel.

**Keywords**: WebSocket, Digital Education, Graasp Platform

# Introduction

*Graasp* provides a social media platform for teachers and students in primary, secondary school and higher education that supports collaborative learning, personal learning and inquiry learning. It aims at providing digital tools for education that resemble social media services which feature web-based applications, user-generated content, service-specific profiles and social networks: "the need to provide a versatile and agile social media platform strengthening digital education has emerged. The main features of such a platform mimicking the social media solutions people are using daily include the ability (i) to create online spaces targeting dedicated learning activities by aggregating resources from various cloud or local sources, (ii) to share these spaces with peers (either teachers or students), (iii) to exploit these spaces by interacting with the integrated resources, available tutors, and collaborating peers, as well as (iv) to archive these spaces together with the learning outcome (produced artifacts) for later use or as proof of personal achievements in lifelong learning." (Gillet et al. 2016)

Starting in 2019, the *Graasp* web software was rewritten to refactor and consolidate its codebase (thereafter referred to as *Graasp v3*) with modern technologies, both on the back-end server side (with tools such as the NodeJS runtime and the Fastify web framework) and in front-end user applications (with e.g. the ReactJS user interface library and ECMAScript 2015). Browser vendors and open standards organizations (e.g. W3C, IETF) also evolved web browsers and Internet protocols into intercompatible systems based on open standards with richer feature sets. In particular the WebSocket protocol was introduced which "enables two-way communication between a client running untrusted code in a controlled environment to a remote host that has opted-in to communications from that code." (RFC 6455)

This allows web applications running in client browsers to keep interacting with (and receiving data from) the server even after the initial request was answered, and without the need for the client to initiate another transaction. In the context of *Graasp*, new features can be developed using this technique. In particular, we are interested in providing real-time notifications that reflect state changes that occured on the server (for instance a document created by a user) directly to all affected clients (such as another user that is currently watching the folder in which the document was created). Real-time notifications can also inform users when unexpected errors occur (e.g. a database server crashing) immediately. Otherwise, the client user would have to wait until he/she performs another action (refreshing the page, clicking on a button) to trigger a new request and then obtain the updated response / error.

WebSocket is thus particularly well-suited for that purpose, as it allows the server to push such notifications directly to connected clients. Other suboptimal techniques (e.g. polling) could also be used, but they consume network resources even when no new state is available.

## Previous work

Preliminary prototypes for real-time content changes were implemented in *Graasp* using Socket.IO, an event-based communication library built on top of WebSocket and HTTP long polling. However, several limitations eventually led to Socket.IO being discarded:

-  **Lack of compatibility**: Socket.IO implements a non-standardized layer of abstraction above WebSocket. As such, clients cannot connect to a Socket.IO server without the corresponding client Socket.IO library, and Socket.IO is not directly compatible with native WebSockets. A client implementation of Socket.IO must exist for every existing platform; even though Java, C++, Swift, Dart, Python and .Net versions are available, this limitation would prevent the Graasp ecosystem to grow outside of these languages.

- **Lack of integration with Fastify**: Authentication through Fastify on Socket.IO resources (such as "rooms") proved to be difficult. In particular, cookie exchanges led to unexpected behaviours.

- **Library size**: The server library of Socket.IO weighs 1.03 MB ([npm](https://www.npmjs.com/package/socket.io)), while the minified client library has a size  of 62.77 KB ([cdnjs](https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.1.1/socket.io.min.js)). By using native WebSockets from the client side, no additional library is required or downloaded.

Hence the notification delivery system in *Graasp v3* requires a domain-specific real-time protocol based on native WebSockets.

## Contributions

This project provides a WebSocket-based solution for real-time delivery of content to specific clients, which can be plugged into the core *Graasp* server code through a single function call. The code is available as an open-source repository on Github ([graasp/graasp-websockets](https://github.com/graasp/graasp-websockets)) with an associated toolchain and continuous integration running on Github Actions. In addition, a client-side API is provided for a sample front-end app (graasp-compose). The code is modularized such that independent components can be reused for different purposes (even unrelated to *Graasp*).

# Requirements

# Implementation

## Back-end: graasp-websockets

### System architecture

### Tooling

## Front-end: graasp-compose

# Future work

# Conclusion

\columnsend

# References

1. Denis Gillet, Andrii Vozniuk, Maria Jesus Rodriguez Triana, and Adrian Christian Holzer. 2016. *"Agile, Versatile, and Comprehensive Social Media Platform  for Creating, Sharing, Exploiting, and Archiving Personal  Learning Spaces, Artifacts, and Traces"* [http://infoscience.epfl.ch/record/221529](http://infoscience.epfl.ch/record/221529)

2. Alexey Melnikov and Ian Fette. Melnikov, Alexey, and Ian Fette. 2011. 
*“The WebSocket Protocol.”* Request for Comments. RFC 6455. [https://doi.org/10.17487/RFC6455](https://doi.org/10.17487/RFC6455)

3. Socket.IO. Accessed on 2021-06-11. [https://socket.io/](https://socket.io/)